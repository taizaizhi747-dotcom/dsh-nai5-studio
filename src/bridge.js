// Native DSH Conversation Composer Bridge (Triple-Channel: Cordis conversation.input store + [data-composer-card] DOM + Clipboard)
const dshComposerBridge = {
  ctx: null,
  sessions: null,
  uiWorkspace: null,
  conversation: null,
  slotProps: null,

  bindHost(host) {
    if (!host) return;
    this.ctx = host;
    if (host.sessions) this.sessions = host.sessions;
    if (host.uiWorkspace) this.uiWorkspace = host.uiWorkspace;
    if (host.conversation) this.conversation = host.conversation;
  },

  bindSlotProps(props) {
    if (props && typeof props === 'object') {
      this.slotProps = props;
    }
  },

  getCurrentSessionId() {
    try {
      if (typeof this.slotProps?.sessionId === 'string' && this.slotProps.sessionId) {
        return this.slotProps.sessionId;
      }
      const sel = this.uiWorkspace?.selection?.getSnapshot?.()?.sessionId;
      if (typeof sel === 'string' && sel) return sel;
      const cur = this.sessions?.list?.getSnapshot?.()?.current;
      if (typeof cur === 'string' && cur) return cur;
    } catch (err) {
      warnSilent('bridge.sessionId', err);
    }
    return '';
  },

  getConversationInput(sessionId) {
    try {
      if (this.slotProps?.inputActions && typeof this.slotProps.inputActions.setDraft === 'function') {
        return this.slotProps.inputActions;
      }
      let conv = this.conversation || this.ctx?.conversation;
      if (!conv && typeof this.ctx?.get === 'function') {
        conv = this.ctx.get('conversation');
      }
      const input = conv?.input;
      if (!input || !sessionId) return null;
      if (typeof input.shell === 'function') {
        try {
          return input.shell(sessionId);
        } catch (err) {
          warnSilent('bridge.inputShell', err);
        }
      }
      const sessions = this.sessions || this.ctx?.sessions;
      const actx = typeof sessions?.scope === 'function' ? sessions.scope(sessionId) : undefined;
      if (typeof input.for === 'function' && actx) {
        return input.for(actx);
      }
    } catch (err) {
      warnSilent('bridge.getInput', err);
    }
    return null;
  },

  findVisibleComposerDom() {
    if (typeof document === 'undefined') return null;
    const EXCLUDE_SELECTOR = '.nai5-floating-window, .nai5-orb-hud, .nai5-lightbox-overlay, .nai5-sidebar-launchpad, .dshp-dock, .rt-dock, .dshp-auth-mask, .dshp-env-gate, [aria-hidden="true"], [inert]';

    const composerRoots = Array.from(document.querySelectorAll('[data-composer-card], [data-composer-seat]'));
    for (let i = composerRoots.length - 1; i >= 0; i--) {
      const root = composerRoots[i];
      const el = root.querySelector('textarea, [contenteditable="true"], [role="textbox"]');
      if (el && (!el.closest || !el.closest(EXCLUDE_SELECTOR))) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 40 && rect.height > 10) return el;
      }
    }

    const candidates = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]'));
    let bestEl = null;
    let bestTop = -Infinity;
    for (const el of candidates) {
      if (el.disabled || el.readOnly || el.hidden) continue;
      if (el.closest && el.closest(EXCLUDE_SELECTOR)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 14) continue;
      if (rect.top >= bestTop) {
        bestTop = rect.top;
        bestEl = el;
      }
    }
    return bestEl;
  },

  injectIntoChat(chatText) {
    if (!chatText) return false;
    const sessionId = this.getCurrentSessionId();
    const inputShell = this.getConversationInput(sessionId);
    const domEl = this.findVisibleComposerDom();

    let existing = '';
    try {
      const snapDraft = inputShell?.state?.getSnapshot?.()?.draft;
      if (typeof snapDraft === 'string') existing = snapDraft;
    } catch (err) {
      warnSilent('bridge.readDraft', err);
    }
    if (!existing && domEl) {
      if (typeof domEl.value === 'string') existing = domEl.value;
      else if (domEl.isContentEditable) existing = domEl.innerText || '';
    }

    const cleanExisting = existing && !existing.includes(chatText.slice(0, 28)) ? existing.trim() : '';
    const finalVal = cleanExisting ? `${cleanExisting}\n${chatText}` : chatText;

    let okStore = false;
    const applyToStore = () => {
      const curSid = this.getCurrentSessionId() || sessionId;
      const shell = this.getConversationInput(curSid) || inputShell;
      if (shell && typeof shell.setDraft === 'function') {
        try {
          shell.setDraft(finalVal);
          okStore = true;
        } catch (err) {
          warnSilent('bridge.setDraft', err);
        }
      }
    };

    const applyToDom = (shouldFocus = false) => {
      const targetEl = this.findVisibleComposerDom() || domEl;
      if (!targetEl) return false;
      try {
        if (shouldFocus) targetEl.focus();
        if (targetEl.tagName === 'TEXTAREA' || targetEl.tagName === 'INPUT') {
          const proto = targetEl.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement?.prototype : window.HTMLInputElement?.prototype;
          const nativeSetter = proto ? Object.getOwnPropertyDescriptor(proto, 'value')?.set : null;
          if (nativeSetter) {
            nativeSetter.call(targetEl, finalVal);
          } else {
            targetEl.value = finalVal;
          }
          try {
            targetEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: finalVal }));
          } catch {
            targetEl.dispatchEvent(new Event('input', { bubbles: true }));
          }
          targetEl.dispatchEvent(new Event('change', { bubbles: true }));
          try {
            const rpKey = Object.keys(targetEl).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
            if (rpKey && targetEl[rpKey] && typeof targetEl[rpKey].onChange === 'function') {
              targetEl[rpKey].onChange({
                target: targetEl,
                currentTarget: targetEl,
                type: 'change',
                nativeEvent: new Event('input', { bubbles: true }),
                preventDefault() {},
                stopPropagation() {},
                isDefaultPrevented: () => false,
                isPropagationStopped: () => false,
                persist() {}
              });
            }
          } catch (err) {
            warnSilent('bridge.reactChange', err);
          }
          if (shouldFocus && typeof targetEl.setSelectionRange === 'function') {
            targetEl.setSelectionRange(finalVal.length, finalVal.length);
          }
          return true;
        } else if (targetEl.isContentEditable) {
          if (!okStore) {
            targetEl.focus();
            const sel = window.getSelection?.();
            if (sel) {
              sel.selectAllChildren(targetEl);
              sel.collapseToEnd();
            }
            document.execCommand('insertText', false, (cleanExisting ? '\n' : '') + chatText);
          }
          return true;
        }
      } catch (err) {
        warnSilent('bridge.applyDom', err);
      }
      return false;
    };

    applyToStore();
    const okDomNow = applyToDom(true);
    if (!okStore && !okDomNow) {
      window.setTimeout(() => {
        applyToStore();
        applyToDom(true);
      }, 80);
    }

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(chatText).catch((err) => warnSilent('bridge.clipboard', err));
      }
    } catch (err) {
      warnSilent('bridge.clipboardSync', err);
    }

    return okStore || okDomNow || Boolean(sessionId);
  }
};

// Global Singleton Controller so Dock, Sidebar, and Keyboard Shortcuts all control the same Floating Window
const studioBus = {
  listeners: new Set(),
  emit(action) {
    this.listeners.forEach(fn => {
      try {
        fn(action);
      } catch (err) {
        warnSilent('studioBus.emit', err);
      }
    });
  }
};

window.__dshOpenNovelAiTab = (mode) => {
  studioBus.emit({ type: 'OPEN', tab: mode || 'studio' });
};
