// Aplica o tema escolhido (claro ou escuro) antes de desenhar a página, para a tela não piscar.
// Sem escolha salva, o app segue o tema do aparelho. A escolha fica só neste aparelho.
(function () {
  try {
    var t = localStorage.getItem('tema');
    if (t === 'claro' || t === 'escuro') document.documentElement.dataset.theme = t === 'escuro' ? 'dark' : 'light';
  } catch (e) { /* sem armazenamento: segue o aparelho */ }
})();
