;(function () {
  'use strict'

  const root = typeof window !== 'undefined' ? window : globalThis
  root.PjeTools = root.PjeTools || {}

  const esc = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  // escape-first; só `*` vira ênfase — `_` é literal (nomes tipo RELATORIO_CALCULO)
  function inline(texto) {
    return esc(texto)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  }

  const ehEspecial = l =>
    /^```/.test(l) || /^#{1,4}\s/.test(l) || /^---+\s*$/.test(l) ||
    /^>\s?/.test(l) || /^\s*[-*]\s+/.test(l) || /^\s*\|/.test(l)

  const celulas = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())

  function renderizar(md) {
    const linhas = String(md ?? '').replace(/\r\n?/g, '\n').split('\n')
    const out = []
    let i = 0
    while (i < linhas.length) {
      const l = linhas[i]

      if (/^```/.test(l)) {
        const buf = []; i++
        while (i < linhas.length && !/^```/.test(linhas[i])) { buf.push(linhas[i]); i++ }
        i++
        out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>')
        continue
      }

      const h = l.match(/^(#{1,4})\s+(.*)$/)
      if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue }

      if (/^---+\s*$/.test(l)) { out.push('<hr>'); i++; continue }

      if (/^\s*\|/.test(l) && i + 1 < linhas.length &&
          /-/.test(linhas[i + 1]) && /^\s*\|?[\s:|-]+\|?\s*$/.test(linhas[i + 1])) {
        const cab = celulas(l); i += 2
        const corpo = []
        while (i < linhas.length && /^\s*\|/.test(linhas[i])) { corpo.push(celulas(linhas[i])); i++ }
        let t = '<table><thead><tr>' + cab.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead>'
        if (corpo.length) t += '<tbody>' + corpo.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody>'
        out.push(t + '</table>')
        continue
      }

      if (/^>\s?/.test(l)) {
        const buf = []
        while (i < linhas.length && /^>\s?/.test(linhas[i])) { buf.push(linhas[i].replace(/^>\s?/, '')); i++ }
        out.push('<blockquote>' + inline(buf.join(' ')) + '</blockquote>')
        continue
      }

      if (/^\s*[-*]\s+/.test(l)) {
        const buf = []
        while (i < linhas.length && /^\s*[-*]\s+/.test(linhas[i])) { buf.push(linhas[i].replace(/^\s*[-*]\s+/, '')); i++ }
        out.push('<ul>' + buf.map(li => `<li>${inline(li)}</li>`).join('') + '</ul>')
        continue
      }

      if (/^\s*$/.test(l)) { i++; continue }

      const buf = [l]; i++
      while (i < linhas.length && !/^\s*$/.test(linhas[i]) && !ehEspecial(linhas[i])) { buf.push(linhas[i]); i++ }
      out.push('<p>' + inline(buf.join(' ')) + '</p>')
    }
    return out.join('\n')
  }

  root.PjeTools.markdown = { renderizar }

  if (typeof module !== 'undefined' && module.exports) module.exports = root.PjeTools.markdown

})()
