// ── 툴팁 ────────────────────────────────────────────
// data-tip 속성이 있는 요소에 마우스를 올리면 도트 말풍선으로 설명을 띄운다.
// 화면을 통째로 다시 그려도 계속 동작하도록 document 하나에만 리스너를 건다.

let box: HTMLDivElement | null = null;
let owner: HTMLElement | null = null;

function show(el: HTMLElement): void {
  const text = el.dataset.tip;
  if (!text) return;
  box ??= document.body.appendChild(document.createElement('div'));
  box.className = 'tooltip';
  const [title, ...lines] = text.split('\n');
  box.innerHTML = '';
  const head = box.appendChild(document.createElement('b'));
  head.textContent = title;
  for (const line of lines) {
    // "용어: 설명" 형태면 용어만 강조
    const row = box.appendChild(document.createElement('div'));
    const m = /^([^:]{1,8}): (.*)$/.exec(line);
    if (m) {
      row.appendChild(document.createElement('em')).textContent = m[1];
      row.append(` ${m[2]}`);
    } else row.textContent = line;
  }
  place(el);
}

/**
 * 요소 위쪽에 띄우고, 공간이 없으면 아래로. 카드는 마우스를 올리면 떠오르므로 옆에 띄운다.
 * 화면 밖으로 나가지 않게 한다.
 */
function place(el: HTMLElement): void {
  if (!box) return;
  const r = el.getBoundingClientRect();
  box.style.visibility = 'hidden';
  box.style.display = 'block';
  const w = box.offsetWidth;
  const h = box.offsetHeight;
  let top: number;
  let left: number;
  if (el.classList.contains('card')) {
    top = Math.max(4, r.top - 24);
    left = r.right + 16 + w < window.innerWidth ? r.right + 16 : r.left - w - 16;
  } else {
    top = r.top - h - 8;
    if (top < 4) top = r.bottom + 8;
    left = r.left + r.width / 2 - w / 2;
  }
  left = Math.min(window.innerWidth - w - 4, Math.max(4, left));
  box.style.left = `${left + window.scrollX}px`;
  box.style.top = `${top + window.scrollY}px`;
  box.style.visibility = 'visible';
}

export function hideTooltip(): void {
  owner = null;
  if (box) box.style.display = 'none';
}

export function installTooltips(): void {
  document.addEventListener('mouseover', (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (el === owner) return;
    owner = el;
    if (el) show(el);
    else hideTooltip();
  });
  // 다시 그려져서 요소가 사라지면 툴팁도 닫는다
  new MutationObserver(() => {
    if (owner && !owner.isConnected) hideTooltip();
  }).observe(document.body, { childList: true, subtree: true });
}
