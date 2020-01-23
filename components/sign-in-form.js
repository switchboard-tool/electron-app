import { html } from '../lib/lit-html.js';
import { component, useContext, useEffect } from '../lib/haunted.js';
import { useFocusVisible } from './use-focus-visible.js';
import { EnvironmentsContext } from './environments-context.js';
import { signIn, reloadAfterSignIn } from '../helpers/auth.js';

function SignInForm() {
  const { FocusVisibleStyle } = useFocusVisible(this.shadowRoot);
  const environmentsContext = useContext(EnvironmentsContext);

  useEffect(() => {
    if (environmentsContext.status === 'signed-out') {
      this.setAttribute('data-active', '');
    } else {
      this.removeAttribute('data-active');
    }
  }, [environmentsContext.status]);

  const onSignIn = async () => {
    await signIn();
    reloadAfterSignIn();
  };

  return html`
    <div class="sign-in-container main__pre-sign-in-container${environmentsContext.status === 'signed-out' ? ' sign-in-container--active' : ''}">
      <button class="button button--primary button--extra-wide button--sign-in" @click=${onSignIn}>Sign in</button>
    </div>
    <style>
      button {
        cursor: pointer;
      }

      .button--primary {
        background-color: white;
        border: none;
        border-radius: 4px;
        color: var(--color-primary);
        height: 2rem;
        padding: 0 1rem;
        font-weight: 600;
        font-size: 0.85rem;
        box-shadow: var(--shadow-2);
        outline-offset: 2px !important;
      }

      .button--primary:hover,
      .button--primary.focus-visible {
        box-shadow: var(--shadow-3);
      }

      .button--primary:active {
        box-shadow: var(--shadow-1);
      }

      .button--extra-wide {
        width: 100%;
        max-width: 24rem;
      }

      .button--sign-in {
        animation: button-enter 400ms 200ms;
        animation-fill-mode: both;
        will-change: transform, opacity;
        box-sizing: border-box;
      }

      .sign-in-container {
        display: none;
        height: 100%;
        justify-content: center;
        align-items: center;
      }

      .sign-in-container--active {
        display: flex;
      }

      .main__pre-sign-in-container {
        flex: 1 0 auto;
      }

      @keyframes button-enter {
        0% {
          transform: translateY(16px);
          opacity: 0;
        }
        100% {
          transform: translateX(0);
          opacity: 1;
        }
      }
    </style>
    ${FocusVisibleStyle}
  `;
}

customElements.define('sb-sign-in-form', component(SignInForm));
