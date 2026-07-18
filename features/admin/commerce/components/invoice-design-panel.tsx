"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer, RotateCcw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { AdminMobileActionBar } from "@/features/admin/components";
import { adminTextareaClassName } from "@/features/admin/products/components/admin-field";
import { InvoiceDocument } from "@/components/shared/invoice-document";
import { defaultInvoiceSettings } from "@/features/commerce/lib/invoice-defaults";
import {
  INVOICE_SETTINGS_UPDATED_EVENT,
  loadInvoiceSettings,
  resetInvoiceSettings,
  saveInvoiceSettings,
} from "@/features/commerce/lib/invoice-settings-repository";
import { SAMPLE_INVOICE_ORDER } from "@/features/admin/commerce/lib/sample-invoice-order";
import {
  getCommerceSettings,
  getContactSettings,
  getGeneralSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import { runBrowserPrint } from "@/features/commerce/lib/print-invoice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { InvoiceSettingsFormData } from "@/types/invoice";
import { cn } from "@/lib/utils";

const VISIBILITY_OPTIONS = [
  { key: "showLogo" as const, label: "Show logo", hint: "Company logo in the header" },
  { key: "showGstNumber" as const, label: "Show GST number", hint: "GSTIN on business block" },
  { key: "showPanNumber" as const, label: "Show PAN number", hint: "PAN on business block" },
  {
    key: "showPaymentDetails" as const,
    label: "Show payment details",
    hint: "Method, status, and reference",
  },
  {
    key: "showDeliveryDetails" as const,
    label: "Show delivery details",
    hint: "Customer address and ETA",
  },
  {
    key: "showOrderStatus" as const,
    label: "Show order status",
    hint: "Fulfillment status badge",
  },
  {
    key: "showTerms" as const,
    label: "Show terms & conditions",
    hint: "Legal footer text",
  },
  {
    key: "showSignature" as const,
    label: "Show signature block",
    hint: "Authorized signatory",
  },
];

function toForm(settings: ReturnType<typeof loadInvoiceSettings>): InvoiceSettingsFormData {
  const { updatedAt: _updatedAt, ...form } = settings;
  return form;
}

export function InvoiceDesignPanel() {
  const [settings, setSettings] = useState<InvoiceSettingsFormData>(() => {
    const { updatedAt: _updatedAt, ...form } = defaultInvoiceSettings;
    return form;
  });
  const [savedSettings, setSavedSettings] = useState(settings);
  const [commerceLabels, setCommerceLabels] = useState({
    taxLabel: defaultCommerceSettings.taxLabel,
    platformChargeLabel: defaultCommerceSettings.platformChargeLabel,
    giftWrapLabel: defaultCommerceSettings.giftWrapLabel,
  });

  function loadAll() {
    const form = toForm(loadInvoiceSettings());
    setSettings(form);
    setSavedSettings(form);
    const commerce = getCommerceSettings();
    setCommerceLabels({
      taxLabel: commerce.taxLabel,
      platformChargeLabel: commerce.platformChargeLabel,
      giftWrapLabel: commerce.giftWrapLabel,
    });
  }

  useEffect(() => {
    loadAll();
    window.addEventListener(INVOICE_SETTINGS_UPDATED_EVENT, loadAll);
    window.addEventListener(SETTINGS_UPDATED_EVENT, loadAll);
    return () => {
      window.removeEventListener(INVOICE_SETTINGS_UPDATED_EVENT, loadAll);
      window.removeEventListener(SETTINGS_UPDATED_EVENT, loadAll);
    };
  }, []);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const previewSettings = useMemo(
    () => ({ ...settings, updatedAt: new Date().toISOString() }),
    [settings]
  );

  function patch(next: Partial<InvoiceSettingsFormData>) {
    setSettings((prev) => ({ ...prev, ...next }));
  }

  function handleSave() {
    const saved = saveInvoiceSettings(settings);
    const form = toForm(saved);
    setSettings(form);
    setSavedSettings(form);
    toast.success("Invoice design saved");
  }

  function handleDiscard() {
    setSettings(savedSettings);
  }

  function handleResetDefaults() {
    const seeded = resetInvoiceSettings();
    const form = toForm(seeded);
    setSettings(form);
    setSavedSettings(form);
    toast.success("Invoice design reset to defaults");
  }

  function handleImportFromSite() {
    const general = getGeneralSettings();
    const contact = getContactSettings();
    patch({
      companyName: general.siteName,
      tagline: general.siteTagline,
      logoUrl: general.logo,
      address: contact.address,
      email: contact.email,
      phone: contact.phone,
    });
    toast.success("Imported branding from site settings");
  }

  return (
    <div className={cn("space-y-4 sm:space-y-5", isDirty && "pb-20 md:pb-0")}>
      <div className="print:hidden space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        {isDirty ? (
          <Button variant="outline" className="hidden md:inline-flex" onClick={handleDiscard}>
            Discard
          </Button>
        ) : null}
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => runBrowserPrint()}
        >
          <Printer className="size-4" />
          Print sample
        </Button>
        <Button
          variant="bakery"
          className={cn("w-full sm:w-auto", isDirty && "hidden md:inline-flex")}
          onClick={handleSave}
          disabled={!isDirty}
        >
          Save design
        </Button>
      </div>

      {!settings.companyName.trim() ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
          Company name is empty. Import from site branding or enter it below before printing
          invoices.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:items-start">
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">Branding</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Company identity at the top of every invoice.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={handleImportFromSite}
                >
                  <Settings2 className="size-4" />
                  Import site
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={handleResetDefaults}
                >
                  <RotateCcw className="size-4" />
                  Reset defaults
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invoice-company">Company name</Label>
                <Input
                  id="invoice-company"
                  value={settings.companyName}
                  onChange={(event) => patch({ companyName: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-tagline">Tagline</Label>
                <Input
                  id="invoice-tagline"
                  value={settings.tagline}
                  onChange={(event) => patch({ tagline: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-logo">Logo URL</Label>
                <Input
                  id="invoice-logo"
                  value={settings.logoUrl}
                  onChange={(event) => patch({ logoUrl: event.target.value })}
                  placeholder="/images/logo.svg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-title">Invoice title</Label>
                <Input
                  id="invoice-title"
                  value={settings.invoiceTitle}
                  onChange={(event) => patch({ invoiceTitle: event.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Business details</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Contact and tax identifiers printed on invoices.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invoice-address">Address</Label>
                <textarea
                  id="invoice-address"
                  className={adminTextareaClassName}
                  rows={3}
                  value={settings.address}
                  onChange={(event) => patch({ address: event.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoice-email">Email</Label>
                  <Input
                    id="invoice-email"
                    value={settings.email}
                    onChange={(event) => patch({ email: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-phone">Phone</Label>
                  <Input
                    id="invoice-phone"
                    type="tel"
                    value={settings.phone}
                    onChange={(event) => patch({ phone: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-website">Website</Label>
                <Input
                  id="invoice-website"
                  value={settings.website}
                  onChange={(event) => patch({ website: event.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoice-gst">GST number</Label>
                  <Input
                    id="invoice-gst"
                    value={settings.gstNumber}
                    onChange={(event) => patch({ gstNumber: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-pan">PAN number</Label>
                  <Input
                    id="invoice-pan"
                    value={settings.panNumber}
                    onChange={(event) => patch({ panNumber: event.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Footer & legal</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Notes, terms, and signature on the printed invoice.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invoice-footer">Footer note</Label>
                <textarea
                  id="invoice-footer"
                  className={adminTextareaClassName}
                  rows={2}
                  value={settings.footerNote}
                  onChange={(event) => patch({ footerNote: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-terms">Terms & conditions</Label>
                <textarea
                  id="invoice-terms"
                  className={adminTextareaClassName}
                  rows={4}
                  value={settings.termsAndConditions}
                  onChange={(event) => patch({ termsAndConditions: event.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoice-signature-name">Signature name</Label>
                  <Input
                    id="invoice-signature-name"
                    value={settings.signatureName}
                    onChange={(event) => patch({ signatureName: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-signature-title">Signature title</Label>
                  <Input
                    id="invoice-signature-title"
                    value={settings.signatureTitle}
                    onChange={(event) => patch({ signatureTitle: event.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Visibility</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose which sections appear on printed invoices.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {VISIBILITY_OPTIONS.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"
                >
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.hint}</p>
                  </div>
                  <Switch
                    checked={settings[item.key]}
                    onCheckedChange={(checked) => patch({ [item.key]: checked })}
                  />
                </label>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="h-full shadow-sm xl:sticky xl:top-24">
          <CardHeader>
            <CardTitle className="text-base">Live preview</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Sample {SAMPLE_INVOICE_ORDER.orderNumber} · {commerceLabels.taxLabel}
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl bg-muted p-4">
              <InvoiceDocument
                order={SAMPLE_INVOICE_ORDER}
                settings={previewSettings}
                taxLabel={commerceLabels.taxLabel}
                platformChargeLabel={commerceLabels.platformChargeLabel}
                giftWrapLabel={commerceLabels.giftWrapLabel}
                variant="screen"
              />
            </div>
          </CardContent>
        </Card>
      </div>
      </div>

      <div className="hidden print:block">
        <InvoiceDocument
          order={SAMPLE_INVOICE_ORDER}
          settings={previewSettings}
          taxLabel={commerceLabels.taxLabel}
          platformChargeLabel={commerceLabels.platformChargeLabel}
          giftWrapLabel={commerceLabels.giftWrapLabel}
          variant="print"
        />
      </div>

      {isDirty ? (
        <AdminMobileActionBar className="md:hidden print:hidden">
          <Button variant="outline" onClick={handleDiscard}>
            Discard
          </Button>
          <Button variant="bakery" onClick={handleSave}>
            Save design
          </Button>
        </AdminMobileActionBar>
      ) : null}
    </div>
  );
}
