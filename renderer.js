const { ipcRenderer } = require('electron');
const urls = require('./urls');

// DOM elements
const body = document.querySelector('body');
const signInButton = document.getElementById('sign-in');
const allEnvironments = document.getElementById('all-environments');
const favoriteEnvironments = document.getElementById('favorite-environments');
const viewToggle = document.getElementById('view-toggle');
const viewToggleV2 = document.querySelector('view-toggle');
const viewCarousel = document.getElementById('view-carousel');
const toolbar = document.getElementById('toolbar');
const scrollAreas = document.getElementsByClassName('js-scroll-area');
const loadingIndicator = document.getElementById('loading-indicator');
const noFavoriteMessage = document.getElementById('no-favorite-message');
const notification = document.getElementById('notification');
const mainMenuButton = document.getElementById('main-menu');

// Handle DOM events
signInButton.onclick = () => ipcRenderer.send('trySignIn');
allEnvironments.onclick = event => handleEnvironmentActions(event);
favoriteEnvironments.onclick = event => handleEnvironmentActions(event);
viewToggle.onclick = () => handleViewToggle();
viewToggleV2.onclick = e => handleViewToggleV2(e);
mainMenuButton.onclick = () => handleMainMenuClick();

// Handle IPC events
ipcRenderer.once('onSignInStatusUpdate', (event, isSignedIn) => {
  if (isSignedIn) {
    body.classList.add('post-sign-in');
    loadingIndicator.dataset.state = 'get-environments';
    ipcRenderer.send('getEnvironments');
    ipcRenderer.send('checkMetadata');
  } else {
    loadingIndicator.dataset.state = 'done';
    body.classList.add('pre-sign-in');
  }
});

// Cache environment list for entire session
let cachedEnvironments = [];

ipcRenderer.once('onEnvironmentsAvailable', (event, { environments, userSettings }) => {
  body.classList.add('environment-available');
  loadingIndicator.dataset.state = 'done';

  cachedEnvironments = environments;
  allEnvironments.innerHTML = renderAllEnvironments({ environments, userSettings, animateEnter: true });
  favoriteEnvironments.innerHTML = renderFavoriteEnvironments({ environments, userSettings, animateEnter: true });

  updateNoFavoriteMessage({ userSettings });
  initializeToggle({ userSettings });
  initializeCarousel();

  scrollObservers = createObserver();
});

ipcRenderer.on('onFavoritesChange', async (event, { userSettings }) => {
  updateAllEnvironments({ userSettings });

  if (viewToggle.dataset.selectedOption === 'favorites') {
    await updateFavoriteEnvironments({ userSettings });
    updateNoFavoriteMessage({ userSettings });
  } else {
    favoriteEnvironments.innerHTML = renderFavoriteEnvironments({ environments: cachedEnvironments, userSettings });
    updateNoFavoriteMessage({ userSettings });
    updateCarouselFocusTargets();
  }
});

ipcRenderer.on('onDownloadProgress', (event, { percent }) => {
  notification.innerText = percent;
});

ipcRenderer.on('onDownloadComplete', (event, { exec }) => {
  notification.innerText = 'Installing...';
});

// Init
ipcRenderer.send('getSignInStatus');
const { initializeChromium } = require('./automation/automation');
initializeChromium().then(() => {
  notification.innerText = 'Installed';
});

// Render functions
function initializeToggle({ userSettings }) {
  const selectedOptions = document.querySelectorAll(`[data-option="${viewToggle.dataset.selectedOption}"]`);
  [...selectedOptions].forEach(option => (option.dataset.selected = ''));

  if (!userSettings.favorites.length) {
    handleViewToggle();
  } else {
    updateCarouselFocusTargets();
  }
}

function initializeCarousel() {
  setTimeout(() => {
    [...viewCarousel.children].forEach(child => (child.dataset.canAnimate = ''));
  }, 100); // without timeout the scroll bar will be part of the slide-in animation
}

function updateCarouselFocusTargets() {
  // out of view buttons should not be focusable, assuming button is the only focusable element
  [...viewCarousel.children].forEach(child => {
    if (child.dataset.selected === undefined) {
      const unreachableButtons = child.querySelectorAll('button');
      [...unreachableButtons].forEach(button => (button.tabIndex = '-1'));
    } else {
      const unreachableButtons = child.querySelectorAll('button');
      [...unreachableButtons].forEach(button => (button.tabIndex = '0'));
    }
  });
}

function renderAllEnvironments({ environments, userSettings, animateEnter }) {
  return environments.map(environment => renderEnvironment({ environment, userSettings, animateEnter })).join('');
}

function renderFavoriteEnvironments({ environments, userSettings, animateEnter }) {
  const favoriteEnvironments = environments.filter(environment => userSettings.favorites.includes(environment.appId));

  return favoriteEnvironments.map(environment => renderEnvironment({ environment, userSettings, animateEnter })).join('');
}

function updateAllEnvironments({ userSettings }) {
  const unFavorited = allEnvironments.querySelectorAll(`[data-action="addFavorite"]`);
  const favorited = allEnvironments.querySelectorAll(`[data-action="removeFavorite"]`);

  [...unFavorited].forEach(item => {
    if (userSettings.favorites.includes(item.dataset.appId)) {
      item.dataset.action = 'removeFavorite';
      item.classList.remove('button--add-favorite');
      item.classList.add('button--remove-favorite');
    }
  });

  [...favorited].forEach(item => {
    if (!userSettings.favorites.includes(item.dataset.appId)) {
      item.dataset.action = 'addFavorite';
      item.classList.remove('button--remove-favorite');
      item.classList.add('button--add-favorite');
    }
  });
}

async function updateFavoriteEnvironments({ userSettings }) {
  return new Promise(resolve => {
    const favorited = favoriteEnvironments.querySelectorAll(`[data-action="removeFavorite"]`);

    [...favorited].forEach(item => {
      if (!userSettings.favorites.includes(item.dataset.appId)) {
        const unFavoritedCard = favoriteEnvironments.querySelector(`.js-card[data-app-id="${item.dataset.appId}"]`);
        unFavoritedCard.addEventListener('animationend', e => {
          if (e.animationName === 'just-wait') {
            unFavoritedCard.parentNode.removeChild(unFavoritedCard);
            resolve();
          }
        });
        unFavoritedCard.classList.add('card--animate-exit');
      }
    });
  });
}

function updateNoFavoriteMessage({ userSettings }) {
  if (userSettings.favorites.length > 0) {
    noFavoriteMessage.classList.remove('no-favorite-message--show');
  } else {
    noFavoriteMessage.classList.add('no-favorite-message--show');
  }
}

function renderEnvironment({ environment, userSettings, animateEnter }) {
  return `
  <div
    class="card js-card${animateEnter ? ' card--animation-enter' : ''}"
    data-app-id="${environment.appId}">
    <div class="card__header">
      <h1 class="card__title">${environment.appName}</h1>
      <button
        class="button button--favorite${userSettings.favorites.includes(environment.appId) ? ' button--remove-favorite' : ' button--add-favorite'}" 
        data-app-id="${environment.appId}"
        data-action="${userSettings.favorites.includes(environment.appId) ? 'removeFavorite' : 'addFavorite'}"
        title="${userSettings.favorites.includes(environment.appId) ? 'Remove from favorites' : 'Add to favorites'}"
      >
        <svg class="star" width="16" height="15">
          <use xlink:href="#svg-star" />
        </svg>     
      </button>
    </div>
    <div class="card__actions">
      ${environment.instances
        .map(instance =>
          `
      <button
        class="button button--primary button--launch"
        data-action="launch"
        data-type=${instance.type}
        data-url="${instance.url}"
        data-username="${instance.username}"
        data-password="${instance.password}"
      >${instance.type}</button>
      `.trim()
        )
        .join('')}
    </div>
  </div>
  `.trim();
}

// Event handler functions
async function handleEnvironmentActions(event) {
  const targetButton = event.target.closest('button');
  if (!targetButton) return;

  if (targetButton.dataset.action === 'launch') {
    const animationEndHandler = e => {
      event.target.classList.remove('button--launching');
      event.target.removeEventListener('animationend', animationEndHandler);
    };
    event.target.addEventListener('animationend', animationEndHandler);
    window.setTimeout(() => {
      event.target.classList.add('button--launching');
    }, 50);

    let { url, username, password } = targetButton.dataset;
    if (event.shiftKey) {
      url = urls.trialAdminPortalUrl;
    }

    const { signInDynamicsUCApp } = require('./automation/automation');
    await signInDynamicsUCApp(url, username, password);
  } else if (targetButton.dataset.action === 'addFavorite') {
    ipcRenderer.send('addFavorite', { appId: targetButton.dataset.appId });
  } else if (targetButton.dataset.action === 'removeFavorite') {
    ipcRenderer.send('removeFavorite', { appId: targetButton.dataset.appId });
  }
}

function handleViewToggleV2(e) {
  if (viewToggleV2.dataset.select === 'left') {
    viewToggleV2.dataset.select = 'right';
  } else if (viewToggleV2.dataset.select === 'right') {
    viewToggleV2.dataset.select = 'left';
  }
}

function handleViewToggle() {
  const selectedOption = viewToggle.dataset.selectedOption;
  const options = [...viewToggle.children];
  const leftLabelWidth = options[0].offsetWidth;

  // on first call, measure left label width
  if (!viewToggle.style.getPropertyValue('--indicator-width')) {
    viewToggle.style.setProperty('--indicator-width', `${leftLabelWidth}px`);
  }

  // update view toggle
  const leavingOption = options.filter(option => option.dataset.option === selectedOption)[0];
  const enteringOption = options.filter(option => option.dataset.option !== selectedOption)[0];
  delete leavingOption.dataset.selected;
  enteringOption.dataset.selected = '';

  viewToggle.dataset.selectedOption = enteringOption.dataset.option;
  viewToggle.style.setProperty('--indicator-width', `${enteringOption.offsetWidth}px`);
  viewToggle.style.setProperty('--indicator-translate', enteringOption === options[1] ? `${leftLabelWidth}px` : '0');

  // update carousel
  const views = [...viewCarousel.querySelectorAll(`[data-option]`)];
  const leavingView = views.filter(view => view.dataset.option === selectedOption)[0];
  const enteringView = views.filter(view => view.dataset.option !== selectedOption)[0];

  delete leavingView.dataset.selected;
  enteringView.dataset.selected = '';
  updateCarouselFocusTargets();

  // reset scroll
  enteringView.scrollTop = 0;
  toolbar.classList.remove('toolbar--with-scroll');
}

async function handleMainMenuClick() {
  // TODO implement toggle behavior
  const menu = await createMenu();
  const { getCurrentWindow } = require('electron').remote;
  menu.popup({ window: getCurrentWindow() });
}

async function createMenu() {
  const { Menu, MenuItem } = require('electron').remote;
  const menu = new Menu();
  const { isUpdateAvailable } = require('./helpers/update');

  const isDownloadUpdateEnabled = await isUpdateAvailable();

  menu.append(
    new MenuItem({
      enabled: isDownloadUpdateEnabled,
      label: 'Download update',
      click: () => ipcRenderer.send('downloadUpdate'),
    })
  );

  menu.append(
    new MenuItem({
      label: 'Sign out',
      click: () => ipcRenderer.send('trySignOut'),
    })
  );
  return menu;
}

function createObserver() {
  [...scrollAreas].map(scrollArea => {
    const options = {
      root: scrollArea,
      rootMargin: '0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver(e => {
      if (e[0].isIntersecting) {
        toolbar.classList.remove('toolbar--with-scroll');
      } else {
        toolbar.classList.add('toolbar--with-scroll');
      }
    }, options);

    observer.observe(scrollArea.querySelector('.js-scroll-sentinel'));
  });
}
