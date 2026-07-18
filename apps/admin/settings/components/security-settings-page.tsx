"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Laptop,
  LogOut,
  MonitorSmartphone,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { clearDemoSession } from "@/features/auth/lib/session";
import { routes } from "@/constants/routes";
import { formatRelativeTime } from "@/utils/format";
import type { SecuritySettings } from "@/types/settings";
import type {
  ActiveSession,
  FailedLoginAttempt,
  LoginHistoryEntry,
  RegisteredDevice,
} from "@/types/security";
import { defaultSecuritySettings } from "@/features/settings/lib/settings-utils";
import {
  getSecuritySettings,
  resetSecuritySettings,
  saveSecuritySettings,
} from "@/features/settings/lib/settings-repository";
import {
  clearFailedLoginAttempts,
  getActiveSessions,
  getFailedLoginAttempts,
  getLoginHistory,
  getRegisteredDevices,
  logoutAllDevices,
  revokeSession,
  SECURITY_CENTER_UPDATED_EVENT,
  toggleDeviceTrust,
} from "@/features/settings/lib/security-center-repository";
import { SettingsSectionShell } from "./settings-section-shell";

type SecurityTab = "policies" | "history" | "failed" | "sessions" | "devices";

/** Shared by the number inputs and the save-time clamp so the two cannot drift apart. */
const SESSION_TIMEOUT = { min: 15, max: 480 } as const;
const LOGIN_ATTEMPTS = { min: 3, max: 10 } as const;

function clamp(value: number, { min, max }: { min: number; max: number }): number {
  return Math.min(max, Math.max(min, value));
}

export function SecuritySettingsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<SecurityTab>("policies");
  const [settings, setSettings] = useState<SecuritySettings>(defaultSecuritySettings);
  const [savedSettings, setSavedSettings] = useState<SecuritySettings>(defaultSecuritySettings);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<FailedLoginAttempt[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [clearFailedOpen, setClearFailedOpen] = useState(false);
  const [logoutEverywhereOpen, setLogoutEverywhereOpen] = useState(false);

  function refreshCenter() {
    setLoginHistory(getLoginHistory());
    setFailedAttempts(getFailedLoginAttempts());
    setSessions(getActiveSessions());
    setDevices(getRegisteredDevices());
  }

  useEffect(() => {
    const loaded = getSecuritySettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    refreshCenter();
    setMounted(true);

    function handleUpdate() {
      refreshCenter();
    }

    window.addEventListener(SECURITY_CENTER_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(SECURITY_CENTER_UPDATED_EVENT, handleUpdate);
  }, []);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  function handleSave() {
    const saved = saveSecuritySettings({
      ...settings,
      sessionTimeoutMinutes: clamp(settings.sessionTimeoutMinutes, SESSION_TIMEOUT),
      maxLoginAttempts: clamp(settings.maxLoginAttempts, LOGIN_ATTEMPTS),
    });
    setSavedSettings(saved);
    setSettings(saved);
    toast.success("Security settings saved");
  }

  function handleDiscard() {
    setSettings(savedSettings);
    toast.message("Discarded unsaved changes");
  }

  function handleReset() {
    const loaded = resetSecuritySettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    toast.success("Security settings reset to defaults");
  }

  function handleRevokeSession(sessionId: string) {
    if (revokeSession(sessionId)) {
      refreshCenter();
      toast.success("Session revoked");
    }
  }

  function handleLogoutAll() {
    const removed = logoutAllDevices();
    refreshCenter();
    toast.success(
      removed > 0
        ? `Signed out ${removed} other device${removed === 1 ? "" : "s"}`
        : "No other active sessions"
    );
  }

  function confirmLogoutEverywhere() {
    logoutAllDevices();
    clearDemoSession();
    setLogoutEverywhereOpen(false);
    toast.success("Signed out on all devices");
    router.push(routes.auth.login);
  }

  function confirmClearFailed() {
    clearFailedLoginAttempts();
    refreshCenter();
    setClearFailedOpen(false);
    toast.success("Failed attempts cleared");
  }

  return (
    <SettingsSectionShell
      title="Security"
      description={
        mounted
          ? `${settings.sessionTimeoutMinutes}m timeout · 2FA ${settings.twoFactorEnabled ? "on" : "off"} · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`
          : "Session policies, login history, active devices, and access controls (demo)."
      }
      isDirty={isDirty}
      mounted={mounted}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
    >
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as SecurityTab)}
        className="space-y-4"
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="history">Login history</TabsTrigger>
          <TabsTrigger value="failed">
            Failed attempts
            {failedAttempts.length > 0 ? (
              <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-xs">
                {failedAttempts.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="sessions">Active sessions</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Session &amp; access</CardTitle>
                <CardDescription>Controls how admin sessions behave in this demo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Session timeout (minutes)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min={SESSION_TIMEOUT.min}
                    max={SESSION_TIMEOUT.max}
                    value={settings.sessionTimeoutMinutes}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        sessionTimeoutMinutes: Number(e.target.value) || 60,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxAttempts">Max login attempts</Label>
                  <Input
                    id="maxAttempts"
                    type="number"
                    min={LOGIN_ATTEMPTS.min}
                    max={LOGIN_ATTEMPTS.max}
                    value={settings.maxLoginAttempts}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        maxLoginAttempts: Number(e.target.value) || 5,
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Policies</CardTitle>
                <CardDescription>
                  Toggle security features for future backend integration.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <PolicySwitch
                  title="Strong passwords"
                  description="Require 8+ chars with mixed case and numbers."
                  checked={settings.requireStrongPasswords}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, requireStrongPasswords: checked }))
                  }
                />
                <PolicySwitch
                  title="Two-factor authentication"
                  description="OTP verification on login (demo toggle)."
                  checked={settings.twoFactorEnabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, twoFactorEnabled: checked }))
                  }
                />
                <PolicySwitch
                  title="Login notifications"
                  description="Email alert when a new device signs in."
                  checked={settings.loginNotifications}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, loginNotifications: checked }))
                  }
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="size-4" />
                Login history
              </CardTitle>
              <CardDescription>Recent sign-in activity across devices.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border rounded-xl border border-border">
              {loginHistory.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No login history yet.
                </p>
              ) : (
                loginHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-start justify-between gap-3 p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={entry.success ? "success" : "destructive"}>
                          {entry.success ? "Success" : "Failed"}
                        </Badge>
                        <span className="text-sm font-medium">{entry.email}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{entry.deviceLabel}</p>
                      <p className="text-xs text-muted-foreground">IP {entry.ipAddress}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(entry.timestamp)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failed">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="size-4" />
                  Failed login attempts
                </CardTitle>
                <CardDescription>Blocked or invalid sign-in attempts.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={failedAttempts.length === 0}
                onClick={() => setClearFailedOpen(true)}
              >
                Clear all
              </Button>
            </CardHeader>
            <CardContent className="divide-y divide-border rounded-xl border border-border">
              {failedAttempts.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No failed attempts.
                </p>
              ) : (
                failedAttempts.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-start justify-between gap-3 p-4"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{entry.email}</p>
                      <p className="text-sm text-muted-foreground">{entry.reason}</p>
                      <p className="text-xs text-muted-foreground">IP {entry.ipAddress}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(entry.timestamp)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleLogoutAll}>
              <LogOut className="size-4" />
              Sign out other devices
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setLogoutEverywhereOpen(true)}
            >
              <AlertTriangle className="size-4" />
              Sign out everywhere
            </Button>
          </div>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MonitorSmartphone className="size-4" />
                Active sessions
              </CardTitle>
              <CardDescription>Devices currently signed in to the admin panel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sessions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No active sessions.
                </p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{session.deviceLabel}</p>
                        {session.isCurrent ? (
                          <Badge variant="success">This device</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {session.email} · IP {session.ipAddress}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last active {formatRelativeTime(session.lastActiveAt)}
                      </p>
                    </div>
                    {!session.isCurrent ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeSession(session.id)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Laptop className="size-4" />
                Registered devices
              </CardTitle>
              <CardDescription>
                Known devices that have accessed this admin account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {devices.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No registered devices.
                </p>
              ) : (
                devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{device.label}</p>
                        {device.trusted ? (
                          <Badge variant="success">
                            <ShieldCheck className="mr-1 size-3" />
                            Trusted
                          </Badge>
                        ) : (
                          <Badge variant="outline">Untrusted</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        IP {device.ipAddress} · Last seen {formatRelativeTime(device.lastSeenAt)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        toggleDeviceTrust(device.id);
                        refreshCenter();
                        toast.success("Device trust updated");
                      }}
                    >
                      {device.trusted ? "Mark untrusted" : "Mark trusted"}
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={clearFailedOpen} onOpenChange={setClearFailedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear failed attempts?</DialogTitle>
            <DialogDescription>
              This removes all recorded failed login attempts from the security center demo data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setClearFailedOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmClearFailed}>
              Clear all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logoutEverywhereOpen} onOpenChange={setLogoutEverywhereOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign out everywhere?</DialogTitle>
            <DialogDescription>
              This ends all admin sessions, including this device, and returns you to the login
              page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setLogoutEverywhereOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmLogoutEverywhere}>
              Sign out everywhere
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSectionShell>
  );
}

function PolicySwitch({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
    </div>
  );
}
