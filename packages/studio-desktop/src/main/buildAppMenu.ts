// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  BrowserWindow,
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
  app,
  dialog,
  shell,
} from "electron";

import StudioAppUpdater from "./StudioAppUpdater";
import StudioWindow from "./StudioWindow";
import { FOXGLOVE_PRODUCT_NAME, FOXGLOVE_PRODUCT_VERSION } from "../common/webpackDefines";

const isMac = process.platform === "darwin";
const getTitleCase = (baseString: string): string =>
  baseString
    .split(" ")
    .map((word) => `${word[0]?.toUpperCase()}${word.substring(1)}`)
    .join(" ");

const closeMenuItem: MenuItemConstructorOptions = isMac ? { role: "close" } : { role: "quit" };

type SectionKey = "app" | "panels" | "resources" | "products" | "contact" | "legal";
type HelpInfo = {
  title: string;
  content?: React.ReactNode;
  url?: string;
};

const helpMenuItems: Map<SectionKey, { subheader: string; links: HelpInfo[] }> = new Map([
  [
    "resources",
    {
      subheader: "External resources",
      links: [
        { title: "Browse docs", url: "https://foxglove.dev/docs" },
        { title: "Join our community", url: "https://foxglove.dev/community" },
      ],
    },
  ],
  [
    "products",
    {
      subheader: "Products",
      links: [
        { title: "Foxglove Studio", url: "https://foxglove.dev/studio" },
        { title: "Foxglove Data Platform", url: "https://foxglove.dev/data-platform" },
      ],
    },
  ],
  [
    "contact",
    {
      subheader: "Contact",
      links: [
        { title: "Give feedback", url: "https://foxglove.dev/contact" },
        { title: "Schedule a demo", url: "https://foxglove.dev/demo" },
      ],
    },
  ],
  [
    "legal",
    {
      subheader: "Legal",
      links: [
        { title: "License terms", url: "https://foxglove.dev/legal/studio-license" },
        { title: "Privacy policy", url: "https://foxglove.dev/legal/privacy" },
      ],
    },
  ],
]);

export function buildAppMenu(browserWindow: BrowserWindow): Menu {
  const menuTemplate: MenuItemConstructorOptions[] = [];

  const checkForUpdatesItem: MenuItemConstructorOptions = {
    label: "Check for Updates…",
    click: () => void StudioAppUpdater.Instance().checkNow(),
    enabled: StudioAppUpdater.Instance().canCheckForUpdates(),
  };

  if (isMac) {
    menuTemplate.push({
      role: "appMenu",
      label: app.name,
      submenu: [
        { role: "about" },
        checkForUpdatesItem,
        { type: "separator" },

        {
          label: "Settings…",
          accelerator: "CommandOrControl+,",
          click: () => browserWindow.webContents.send("open-app-settings"),
        },
        { role: "services" },
        { type: "separator" },

        { type: "separator" },

        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { role: "quit" },
      ],
    });
  }

  menuTemplate.push({
    role: "fileMenu",
    label: "File",
    id: "fileMenu",
    submenu: [
      {
        label: "New Window",
        click: () => {
          new StudioWindow().load();
        },
      },
      ...(isMac
        ? []
        : [
            { type: "separator" } as const,
            {
              label: "Settings…",
              accelerator: "CommandOrControl+,",
              click: () => browserWindow.webContents.send("open-app-settings"),
            } as const,
          ]),
      { type: "separator" },
      closeMenuItem,
    ],
  });

  menuTemplate.push({
    role: "editMenu",
    label: "Edit",
    submenu: [
      {
        label: "Add Panel to Layout",
        click: () => browserWindow.webContents.send("open-add-panel"),
      },
      {
        label: "Edit Panel Settings",
        click: () => browserWindow.webContents.send("open-panel-settings"),
      },
      { type: "separator" },

      { role: "undo" },
      { role: "redo" },
      { type: "separator" },

      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      ...(isMac
        ? [
            { role: "pasteAndMatchStyle" } as const,
            { role: "delete" } as const,
            { role: "selectAll" } as const,
          ]
        : [
            { role: "delete" } as const,
            { type: "separator" } as const,
            { role: "selectAll" } as const,
          ]),
    ],
  });

  const showSharedWorkersMenu = () => {
    // Electron doesn't let us update dynamic menus when they are being opened, so just open a popup
    // context menu. This is ugly, but only for development anyway.
    // https://github.com/electron/electron/issues/528
    const workers = browserWindow.webContents.getAllSharedWorkers();
    Menu.buildFromTemplate(
      workers.length === 0
        ? [{ label: "No Shared Workers", enabled: false }]
        : workers.map(
            (worker) =>
              new MenuItem({
                label: worker.url,
                click() {
                  browserWindow.webContents.closeDevTools();
                  browserWindow.webContents.inspectSharedWorkerById(worker.id);
                },
              }),
          ),
    ).popup();
  };

  menuTemplate.push({
    role: "viewMenu",
    label: "View",
    submenu: [
      { label: "Layouts", click: () => browserWindow.webContents.send("open-layouts") },
      { label: "Variables", click: () => browserWindow.webContents.send("open-variables") },
      { label: "Extensions", click: () => browserWindow.webContents.send("open-extensions") },
      { label: "Account", click: () => browserWindow.webContents.send("open-account") },
      { type: "separator" },

      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
      { type: "separator" },
      {
        label: "Advanced",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          {
            label: "Inspect Shared Worker…",
            click() {
              showSharedWorkersMenu();
            },
          },
        ],
      },
    ],
  });

  const showAboutDialog = () => {
    void dialog.showMessageBox(browserWindow, {
      type: "info",
      title: `About ${FOXGLOVE_PRODUCT_NAME}`,
      message: FOXGLOVE_PRODUCT_NAME,
      detail: `Version: ${FOXGLOVE_PRODUCT_VERSION}`,
    });
  };

  const helpSidebarItems = Array.from(helpMenuItems.values(), ({ subheader, links }) => ({
    label: getTitleCase(subheader),
    submenu: links.map(({ title, url }) => ({
      label: getTitleCase(title),
      click: url
        ? async () => await shell.openExternal(url)
        : () => browserWindow.webContents.send("open-help"),
    })),
  }));

  menuTemplate.push({
    role: "help",
    submenu: [
      {
        label: "Explore Sample Data",
        click: () => browserWindow.webContents.send("open-sample-data"),
      },
      { type: "separator" },
      ...helpSidebarItems,
      {
        label: "Learn More",
        click: async () => await shell.openExternal("https://foxglove.dev"),
      },
      ...(isMac
        ? []
        : [
            { type: "separator" } as const,
            {
              label: "About",
              click() {
                showAboutDialog();
              },
            },
            checkForUpdatesItem,
          ]),
    ],
  });

  return Menu.buildFromTemplate(menuTemplate);
}
