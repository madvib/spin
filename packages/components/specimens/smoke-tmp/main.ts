import "../../src/spin-menu/spin-menu-fsm.html";

const host = document.getElementById("host") as HTMLElement;
const spacer = document.createElement("div");
spacer.className = "flex items-center gap-2 p-4 text-sm";
host.style.minWidth = "700px";
host.appendChild(spacer);

const menu = document.createElement("spin-menu-fsm");
menu.id = "menu";
(menu as unknown as { items: string }).items = JSON.stringify([
  { value: "new", label: "New file", shortcut: "Ctrl N" },
  { value: "copy", label: "Copy", shortcut: "Ctrl C" },
  { value: "delete", label: "Delete", disabled: true },
  { separator: true },
  {
    value: "share",
    label: "Share",
    children: [
      { value: "mail", label: "Email link" },
      { value: "chat", label: "Send to chat" },
    ],
  },
]);
const status = document.createElement("div");
status.id = "status";
const opened = document.createElement("div");
opened.id = "opened";
menu.addEventListener("select", (event) => {
  status.textContent = `selected: ${(event as CustomEvent<{ value: string }>).detail.value}`;
});
menu.addEventListener("open-change", (event) => {
  opened.textContent = String((event as CustomEvent<{ open: boolean }>).detail.open);
});
host.append(menu, status, opened);
