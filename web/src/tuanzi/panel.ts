export interface PanelButton {
  label: string;
  onClick: () => void;
  selected?: () => boolean;
}

/** 调试面板：几组按钮和一块读数。只给团子小样用，不是产品界面。 */
export class Panel {
  private readonly readouts = new Map<string, HTMLElement>();
  private readonly toggles: { element: HTMLButtonElement; selected: () => boolean }[] = [];

  constructor(private host: HTMLElement) {}

  heading(text: string, note?: string) {
    const h = document.createElement('h1');
    h.textContent = text;
    this.host.append(h);
    if (note) {
      const p = document.createElement('p');
      p.className = 'note';
      p.textContent = note;
      this.host.append(p);
    }
  }

  group(title: string, buttons: PanelButton[]) {
    const section = document.createElement('section');
    const h = document.createElement('h2');
    h.textContent = title;
    const row = document.createElement('div');
    row.className = 'buttons';
    for (const button of buttons) {
      const element = document.createElement('button');
      element.type = 'button';
      element.textContent = button.label;
      element.addEventListener('click', () => {
        button.onClick();
        this.refresh();
      });
      if (button.selected) this.toggles.push({ element, selected: button.selected });
      row.append(element);
    }
    section.append(h, row);
    this.host.append(section);
    this.refresh();
  }

  readout(title: string, rows: string[]) {
    const section = document.createElement('section');
    const h = document.createElement('h2');
    h.textContent = title;
    const list = document.createElement('dl');
    for (const row of rows) {
      const dt = document.createElement('dt');
      dt.textContent = row;
      const dd = document.createElement('dd');
      dd.textContent = '—';
      list.append(dt, dd);
      this.readouts.set(row, dd);
    }
    section.append(h, list);
    this.host.append(section);
  }

  set(row: string, value: string, ok?: boolean) {
    const element = this.readouts.get(row);
    if (!element) return;
    element.textContent = value;
    element.dataset.state = ok === undefined ? '' : ok ? 'ok' : 'bad';
  }

  refresh() {
    for (const { element, selected } of this.toggles) element.setAttribute('aria-pressed', String(selected()));
  }
}
