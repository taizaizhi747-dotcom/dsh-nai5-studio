function useAccounts(showToast) {
  const [balance, setBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [accountInfo, setAccountInfo] = useState({
    configured: null,
    tier: '',
    balanceSupported: true,
    activeAccountId: '',
    activeAccountName: '',
    endpoint: ''
  });
  const [accountsData, setAccountsData] = useState({ activeAccountId: '', accounts: [] });
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountBusyId, setAccountBusyId] = useState('');
  const [showAddAccountForm, setShowAddAccountForm] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    name: '',
    endpoint: 'https://image.novelai.net',
    token: ''
  });
  const [accountTestResults, setAccountTestResults] = useState({});
  const accountWrapRef = useRef(null);

  const fetchBalance = useCallback(async () => {
    setLoadingBalance(true);
    try {
      const res = await fetch('/api/novelai/state');
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setBalance(data.configured === false ? null : data.anlasBalance);
          setAccountInfo({
            configured: data.configured !== false,
            tier: data.tier || '',
            balanceSupported: data.balanceSupported !== false,
            activeAccountId: data.accountId || '',
            activeAccountName: data.accountName || '',
            endpoint: data.endpoint || ''
          });
        }
      }
    } catch (err) {
      warnSilent('accounts.fetchBalance', err);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/novelai/accounts');
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          const list = Array.isArray(data.accounts) ? data.accounts : [];
          setAccountsData({
            activeAccountId: data.activeAccountId || '',
            accounts: list
          });
          setAccountsLoaded(true);
          if (list.length === 0) {
            setShowAddAccountForm(true);
          }
        }
      }
    } catch (err) {
      warnSilent('accounts.fetchList', err);
    }
  }, []);

  const openConfigureAccount = useCallback(() => {
    setAccountMenuOpen(true);
    setShowAddAccountForm(true);
    fetchAccounts();
  }, [fetchAccounts]);

  const handleSwitchAccount = useCallback(async (accId) => {
    if (!accId || accountBusyId) return;
    setAccountBusyId(accId);
    try {
      const res = await fetch('/api/novelai/accounts/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: accId })
      });
      const data = await res.json();
      if (data.ok) {
        setAccountsData({
          activeAccountId: data.activeAccountId || '',
          accounts: Array.isArray(data.accounts) ? data.accounts : []
        });
        setAccountMenuOpen(false);
        showToast(`已切换账号：${data.activeAccount?.name || accId}`);
        fetchBalance();
      } else {
        showToast(`切换账号失败：${data.error || '未知错误'}`);
      }
    } catch (err) {
      showToast(`切换异常：${err.message}`);
    } finally {
      setAccountBusyId('');
    }
  }, [accountBusyId, fetchBalance, showToast]);

  const handleAddAccount = useCallback(async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const ep = String(newAccountForm.endpoint || '').trim();
    const tk = String(newAccountForm.token || '').trim();
    const nm = String(newAccountForm.name || '').trim();
    if (!ep || !tk) {
      showToast('请填写接口地址 (Endpoint) 和 API Key');
      return;
    }
    setAccountBusyId('__add__');
    try {
      const res = await fetch('/api/novelai/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nm, endpoint: ep, token: tk, activate: true })
      });
      const data = await res.json();
      if (data.ok) {
        setAccountsData({
          activeAccountId: data.activeAccountId || '',
          accounts: Array.isArray(data.accounts) ? data.accounts : []
        });
        setAccountsLoaded(true);
        setNewAccountForm({ name: '', endpoint: 'https://image.novelai.net', token: '' });
        setShowAddAccountForm(false);
        showToast(`已添加并启用账号：${data.account?.name || ep}`);
        fetchBalance();
      } else {
        showToast(`添加失败：${data.error || '未知错误'}`);
      }
    } catch (err) {
      showToast(`请求异常：${err.message}`);
    } finally {
      setAccountBusyId('');
    }
  }, [newAccountForm, fetchBalance, showToast]);

  const handleDeleteAccount = useCallback(async (accId, accName) => {
    if (!accId || accountBusyId) return;
    setAccountBusyId(accId);
    try {
      const res = await fetch('/api/novelai/accounts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: accId })
      });
      const data = await res.json();
      if (data.ok) {
        setAccountsData({
          activeAccountId: data.activeAccountId || '',
          accounts: Array.isArray(data.accounts) ? data.accounts : []
        });
        showToast(`已删除账号：${accName || accId}`);
        fetchBalance();
      } else {
        showToast(`删除失败：${data.error || '未知错误'}`);
      }
    } catch (err) {
      showToast(`删除异常：${err.message}`);
    } finally {
      setAccountBusyId('');
    }
  }, [accountBusyId, fetchBalance, showToast]);

  const handleTestAccount = useCallback(async (accId) => {
    if (!accId) return;
    setAccountTestResults(prev => ({ ...prev, [accId]: { testing: true } }));
    try {
      const res = await fetch('/api/novelai/accounts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: accId })
      });
      const data = await res.json();
      if (data.ok) {
        const label = data.balanceSupported !== false
          ? `${data.anlasBalance} Anlas · ${data.latencyMs || 0}ms`
          : `${data.tier || '中转'} (${data.modelsCount || 0} 模型) · ${data.latencyMs || 0}ms`;
        setAccountTestResults(prev => ({ ...prev, [accId]: { ok: true, label } }));
      } else {
        setAccountTestResults(prev => ({ ...prev, [accId]: { ok: false, label: data.error || '连接失败' } }));
      }
    } catch (err) {
      setAccountTestResults(prev => ({ ...prev, [accId]: { ok: false, label: err.message } }));
    }
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onDocMouseDown = (ev) => {
      if (accountWrapRef.current && !accountWrapRef.current.contains(ev.target)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [accountMenuOpen]);

  return {
    balance,
    loadingBalance,
    accountsLoaded,
    accountInfo,
    accountsData,
    setAccountsData,
    accountMenuOpen,
    setAccountMenuOpen,
    accountBusyId,
    showAddAccountForm,
    setShowAddAccountForm,
    newAccountForm,
    setNewAccountForm,
    accountTestResults,
    accountWrapRef,
    fetchBalance,
    fetchAccounts,
    openConfigureAccount,
    handleSwitchAccount,
    handleAddAccount,
    handleDeleteAccount,
    handleTestAccount
  };
}

function AccountPopover({
  accountWrapRef,
  accountsData,
  accountInfo,
  accountMenuOpen,
  setAccountMenuOpen,
  fetchAccounts,
  showAddAccountForm,
  setShowAddAccountForm,
  accountBusyId,
  handleSwitchAccount,
  handleTestAccount,
  handleDeleteAccount,
  newAccountForm,
  setNewAccountForm,
  handleAddAccount,
  accountTestResults
}) {
  const list = accountsData.accounts || [];
  const activeAcc = list.find(a => a.isActive || a.id === accountsData.activeAccountId) || null;
  const activeLabel = activeAcc?.name || accountInfo.activeAccountName || (list.length === 0 ? '配置账号' : '切换账号');
  const showFormEffective = showAddAccountForm || list.length === 0;

  return h('div', {
    ref: accountWrapRef,
    className: 'nai5-account-wrap',
    onMouseDown: (e) => e.stopPropagation()
  },
    h('button', {
      type: 'button',
      className: `nai5-btn xs nai5-account-btn ${accountMenuOpen || list.length === 0 ? 'primary' : ''}`,
      title: activeAcc ? `当前账号: ${activeAcc.name} (${activeAcc.endpoint})，点击切换或管理` : '点击配置 NovelAI API 账号',
      onClick: () => {
        setAccountMenuOpen(open => {
          const next = !open;
          if (next) fetchAccounts();
          return next;
        });
      }
    },
      h(Icon, { name: 'user', size: 12 }),
      h('span', { className: 'nai5-account-btn-label' }, activeLabel),
      h(Icon, { name: 'chevronDown', size: 11 })
    ),
    accountMenuOpen && h('div', {
      className: 'nai5-account-popover',
      onMouseDown: (e) => e.stopPropagation()
    },
      h('div', { className: 'nai5-account-pop-head' },
        h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } },
          h(Icon, { name: 'users', size: 13, style: { color: 'var(--fx-crimson-soft)' } }),
          `API 账号管理 (${list.length})`
        ),
        list.length > 0 && h('button', {
          type: 'button',
          className: 'nai5-btn xs',
          onClick: () => setShowAddAccountForm(v => !v)
        },
          h(Icon, { name: showAddAccountForm ? 'minus' : 'plus', size: 11 }),
          h('span', null, showAddAccountForm ? '收起' : '添加账号')
        )
      ),
      list.length === 0 && h('div', {
        style: {
          fontSize: '11px',
          lineHeight: 1.5,
          color: 'var(--fx-text-secondary)',
          padding: '6px 8px',
          borderRadius: '7px',
          background: 'rgba(224, 40, 79, 0.08)',
          border: '1px solid rgba(224, 40, 79, 0.22)'
        }
      }, '首次使用请添加 NovelAI 官方 API (https://image.novelai.net) 或兼容中转站凭据，密钥仅保存在本机配置文件中。'),
      list.length > 0 && h('div', { className: 'nai5-account-list' },
        list.map(acc => {
          const testRes = accountTestResults[acc.id];
          const isBusy = accountBusyId === acc.id;
          return h('div', {
            key: acc.id,
            className: `nai5-account-item ${acc.isActive ? 'active' : ''}`,
            onClick: () => {
              if (!acc.isActive && !isBusy) handleSwitchAccount(acc.id);
            }
          },
            h('div', { className: 'nai5-account-meta' },
              h('div', { className: 'nai5-account-title-row' },
                h('span', { className: 'nai5-account-name' }, acc.name),
                acc.isActive && h('span', { className: 'nai5-account-badge' }, '当前')
              ),
              h('span', { className: 'nai5-account-sub' }, `${acc.endpoint.replace(/^https?:\/\//i, '')} · ${acc.tokenMasked}`),
              testRes && h('span', {
                style: {
                  fontSize: '10px',
                  color: testRes.testing ? 'var(--fx-text-muted)' : (testRes.ok ? '#34d399' : '#f87171')
                }
              }, testRes.testing ? '测速连接中...' : (testRes.ok ? `✓ ${testRes.label}` : `✗ ${testRes.label}`))
            ),
            h('div', {
              className: 'nai5-account-actions',
              onClick: (e) => e.stopPropagation()
            },
              h('button', {
                type: 'button',
                className: 'nai5-btn xs',
                title: '测试该账号连通性与余额',
                disabled: Boolean(testRes?.testing),
                onClick: () => handleTestAccount(acc.id)
              }, h(Icon, { name: 'refresh', size: 11 })),
              list.length > 1 && h('button', {
                type: 'button',
                className: 'nai5-btn xs',
                title: '删除此账号配置',
                disabled: isBusy,
                onClick: () => handleDeleteAccount(acc.id, acc.name)
              }, h(Icon, { name: 'trash', size: 11 }))
            )
          );
        })
      ),
      showFormEffective && h('form', {
        className: 'nai5-account-form',
        onSubmit: handleAddAccount
      },
        h('input', {
          type: 'text',
          className: 'nai5-account-input',
          placeholder: '备注名称 (可选，如: NovelAI 官方)',
          value: newAccountForm.name,
          onChange: (e) => setNewAccountForm(prev => ({ ...prev, name: e.target.value }))
        }),
        h('input', {
          type: 'text',
          className: 'nai5-account-input',
          placeholder: '接口地址 Endpoint (如 https://image.novelai.net)',
          value: newAccountForm.endpoint,
          onChange: (e) => setNewAccountForm(prev => ({ ...prev, endpoint: e.target.value }))
        }),
        h('input', {
          type: 'password',
          className: 'nai5-account-input',
          placeholder: 'API Key / Token (pst-... 或 sk-...)',
          value: newAccountForm.token,
          onChange: (e) => setNewAccountForm(prev => ({ ...prev, token: e.target.value }))
        }),
        h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '6px' } },
          list.length > 0 && h('button', {
            type: 'button',
            className: 'nai5-btn xs',
            onClick: () => setShowAddAccountForm(false)
          }, '取消'),
          h('button', {
            type: 'submit',
            className: 'nai5-btn xs primary',
            disabled: accountBusyId === '__add__'
          }, accountBusyId === '__add__' ? '保存中...' : '保存并切换')
        )
      )
    )
  );
}
