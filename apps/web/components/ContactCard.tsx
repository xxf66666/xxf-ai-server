'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Mail, MessageSquare, X } from 'lucide-react';
import { useT } from '../lib/i18n/context';

const EMAIL = 'xixiyeyu@gmail.com';
const WECHAT_QR = '/relation/wechat.jpg';

// Small contact card: email link + "Show WeChat QR" button that
// opens a lightweight modal with the QR image. Usable on both the
// marketing surface and inside the authenticated console.
export function ContactCard({
  variant = 'panel',
}: {
  variant?: 'panel' | 'compact';
}) {
  const t = useT();
  const [qrOpen, setQrOpen] = useState(false);

  if (variant === 'compact') {
    // Inline row — good for a sidebar or the footer edge.
    return (
      <>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <a
            href={`mailto:${EMAIL}`}
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <Mail className="h-3.5 w-3.5" />
            {EMAIL}
          </a>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {t('contact.wechat')}
          </button>
        </div>
        {qrOpen && <QrModal onClose={() => setQrOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-background p-5">
        <div className="mb-3 text-sm font-semibold">{t('contact.title')}</div>
        <div className="text-xs text-muted-foreground">{t('contact.subtitle')}</div>
        <div className="mt-4 space-y-2">
          <a
            href={`mailto:${EMAIL}`}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-xs">{EMAIL}</span>
          </a>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span>{t('contact.wechat.show')}</span>
          </button>
        </div>
      </div>
      {qrOpen && <QrModal onClose={() => setQrOpen(false)} />}
    </>
  );
}

function QrModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xs rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label={t('common.dismiss')}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold">{t('contact.wechat.title')}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t('contact.wechat.scanHint')}
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-white p-2">
          <Image
            src={WECHAT_QR}
            alt="WeChat QR"
            width={320}
            height={320}
            className="h-auto w-full"
            priority
          />
        </div>
      </div>
    </div>
  );
}
