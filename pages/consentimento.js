;(function () {
  'use strict'

  const { consentimento } = window.PjeTools

  document.getElementById('btnConcordo').addEventListener('click', async () => {
    await consentimento.registrar()
    document.getElementById('termo').hidden  = true
    document.getElementById('aceito').hidden = false
  })

  document.getElementById('btnRecuso').addEventListener('click', async () => {
    // uninstallSelf() não exige a permissão "management" no Firefox.
    try {
      await browser.management.uninstallSelf({
        showConfirmDialog: true,
        dialogMessage: 'Sem o aceite dos termos, a extensão Severino JT não pode funcionar e será removida.'
      })
    } catch (e) {
      console.log('[PJeTools Consentimento]', e?.message ?? e)
    }
  })

})()
