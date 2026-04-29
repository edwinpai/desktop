import { useEffect } from "react";

interface SystemTraySetupProps {
  onNewSession?: () => void;
  onShowWindow?: () => void;
}

export function SystemTraySetup({
  onNewSession,
  onShowWindow,
}: SystemTraySetupProps) {
  useEffect(() => {
    let trayIcon: Awaited<ReturnType<typeof import("@tauri-apps/api/tray").TrayIcon.new>> | null = null;

    async function setupTray() {
      try {
        const { TrayIcon } = await import("@tauri-apps/api/tray");
        const { Menu, MenuItem, PredefinedMenuItem } = await import(
          "@tauri-apps/api/menu"
        );
        const { getCurrentWindow } = await import(
          "@tauri-apps/api/window"
        );
        const { exit } = await import("@tauri-apps/plugin-process");

        const showItem = await MenuItem.new({
          text: "Show Window",
          action: async () => {
            const win = getCurrentWindow();
            await win.show();
            await win.unminimize();
            await win.setFocus();
            onShowWindow?.();
          },
        });

        const newSessionItem = await MenuItem.new({
          text: "New Session",
          action: () => {
            onNewSession?.();
          },
        });

        const separator = await PredefinedMenuItem.new({
          item: "Separator",
        });

        const quitItem = await MenuItem.new({
          text: "Quit",
          action: async () => {
            await exit(0);
          },
        });

        const menu = await Menu.new({
          items: [showItem, newSessionItem, separator, quitItem],
        });

        trayIcon = await TrayIcon.new({
          menu,
          tooltip: "EdwinPAI",
          menuOnLeftClick: true,
        });
      } catch (err) {
        console.warn("System tray setup failed (may not be available on this platform):", err);
      }
    }

    setupTray();

    return () => {
      trayIcon?.close().catch(() => {});
    };
  }, [onNewSession, onShowWindow]);

  return null;
}
