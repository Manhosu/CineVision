'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';
import { useCartStore } from '@/stores/cartStore';

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// useSearchParams() requires a Suspense boundary for Next.js 14 static
// prerendering — without it the build fails with "missing-suspense-with-csr-bailout".
export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black p-8 text-center text-white">
          Carregando pedido...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params?.get('token') || null;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const cartClear = useCartStore((s) => s.clear);
  const [whatsappValue, setWhatsappValue] = useState('');
  const [whatsappSaving, setWhatsappSaving] = useState(false);
  const [whatsappSaved, setWhatsappSaved] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/cart');
      return;
    }
    let cancelled = false;
    let cartCleared = false;
    const load = async () => {
      try {
        const data = await api.get<any>(`/api/v1/orders/token/${token}`);
        if (cancelled) return;
        setOrder(data);
        setLoading(false);
        if (data?.status === 'paid') {
          setPolling(false);
          // Wipe the cart the moment we observe payment confirmed.
          // Backend markOrderPaid clears the cart for logged-in users,
          // but anonymous/session-cart users have no user_id on the
          // order — without this, returning to /cart would still show
          // their just-paid items.
          if (!cartCleared) {
            cartCleared = true;
            cartClear().catch(() => { /* best effort */ });
          }
        }
      } catch (err: any) {
        toast.error(err.message || 'Pedido não encontrado');
        setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 4000);
    setPolling(true);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, router, cartClear]);

  const copyPix = () => {
    if (!order?.payment?.provider_meta?.qr_code) return;
    navigator.clipboard.writeText(order.payment.provider_meta.qr_code);
    toast.success('Código PIX copiado!');
  };

  if (loading) {
    return <div className="min-h-screen bg-black p-8 text-center text-white">Carregando pedido...</div>;
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-black p-8 text-center text-white">
        <p className="mb-4">Pedido não encontrado.</p>
        <Link href="/cart" className="text-red-400 underline">
          Voltar ao carrinho
        </Link>
      </div>
    );
  }

  const qrB64 = order.payment?.provider_meta?.qr_code_base64;
  const qrCode = order.payment?.provider_meta?.qr_code;
  const paid = order.status === 'paid';
  // Order paga sem chat_id é o caso "comprou via web sem ter aberto o
  // bot ainda" (Yanna). Mostramos um botão de receber via Telegram
  // que aciona o claim no bot via deep link.
  const needsTelegramClaim = paid && !order.telegram_chat_id;
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'cinevisionv2bot';
  const claimDeepLink = `https://t.me/${botUsername}?start=order_${order.order_token}`;
  const hasWhatsappCaptured = !!order.customer_whatsapp || whatsappSaved;

  const saveWhatsapp = async () => {
    const digits = whatsappValue.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) {
      toast.error('Informe um WhatsApp válido (ex: 21 99828-0890)');
      return;
    }
    setWhatsappSaving(true);
    try {
      await api.post(`/api/v1/orders/token/${token}/whatsapp`, { whatsapp: digits });
      setWhatsappSaved(true);
      toast.success('WhatsApp salvo. Vamos te avisar caso precisar!');
    } catch (err: any) {
      toast.error(err.message || 'Falha ao salvar');
    } finally {
      setWhatsappSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-zinc-900 p-6">
        {paid ? (
          <div className="text-center">
            <div className="mb-4 text-6xl">✅</div>
            <h1 className="mb-2 text-3xl font-bold text-green-400">Pagamento confirmado!</h1>
            {needsTelegramClaim ? (
              <>
                <p className="mb-6 text-zinc-300">
                  Para receber os links dos seus filmes, abra o nosso bot no Telegram clicando
                  abaixo. A entrega é automática logo após você abrir o chat.
                </p>
                <a
                  href={claimDeepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-3 inline-flex items-center gap-2 rounded-lg bg-[#229ED9] px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/30 hover:brightness-110"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  Receber pelo Telegram
                </a>
                <p className="mb-6 text-xs text-zinc-500">
                  Já abriu o bot e ainda não recebeu? <Link href="/minha-lista" className="text-red-400 underline">Ver meus filmes</Link>
                </p>

                {/* Captura de WhatsApp pra recuperação manual caso a
                    pessoa feche a aba sem clicar no botão acima.
                    Igor opera tráfego pelo WhatsApp, então esse é o
                    canal de recuperação prioritário. */}
                <div className="mt-4 rounded-xl border border-white/10 bg-zinc-950 p-5 text-left">
                  {hasWhatsappCaptured ? (
                    <div className="flex items-start gap-3 text-sm">
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="font-semibold text-green-400">WhatsApp salvo!</p>
                        <p className="mt-1 text-xs text-zinc-400">
                          Caso você feche essa página antes de receber os filmes pelo bot, vamos te chamar no WhatsApp.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <label htmlFor="orphan-whatsapp" className="mb-1 block text-sm font-semibold text-white">
                        💬 Quer um plano B no WhatsApp?
                      </label>
                      <p className="mb-3 text-xs text-zinc-400">
                        Se você ainda não usa Telegram ou prefere receber suporte por WhatsApp, deixe seu número.
                        A gente te chama caso precise. <span className="text-zinc-500">Opcional.</span>
                      </p>
                      <div className="flex gap-2">
                        <input
                          id="orphan-whatsapp"
                          type="tel"
                          inputMode="numeric"
                          placeholder="(21) 99828-0890"
                          value={whatsappValue}
                          onChange={(e) => setWhatsappValue(e.target.value)}
                          disabled={whatsappSaving}
                          className="flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-green-500 focus:outline-none disabled:opacity-50"
                        />
                        <button
                          onClick={saveWhatsapp}
                          disabled={whatsappSaving || !whatsappValue.trim()}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {whatsappSaving ? '...' : 'Salvar'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="mb-6 text-zinc-300">
                  Você receberá os links dos filmes pelo Telegram em instantes.
                </p>
                <Link
                  href="/minha-lista"
                  className="inline-block rounded-lg bg-red-600 px-6 py-3 font-semibold text-white"
                >
                  Ver meus filmes
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <h1 className="mb-1 text-2xl font-bold">Pague para liberar seus filmes</h1>
            <p className="mb-6 text-sm text-zinc-400">
              Escaneie o QR code ou copie o código PIX abaixo. A confirmação acontece em até 1 minuto.
            </p>

            <div className="mb-6 flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-black p-6">
              {qrB64 ? (
                <Image
                  src={qrB64.startsWith('data:') ? qrB64 : `data:image/png;base64,${qrB64}`}
                  alt="QR PIX"
                  width={240}
                  height={240}
                  className="rounded-lg bg-white p-2"
                />
              ) : (
                <div className="text-zinc-500">QR Code não disponível</div>
              )}

              <div className="w-full">
                <label className="text-xs text-zinc-500">Código copia-e-cola</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={qrCode || ''}
                    className="flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 text-xs text-zinc-300"
                  />
                  <button
                    onClick={copyPix}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Copiar
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-zinc-950 p-4">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-zinc-400">Itens no pedido</span>
                <span>{order.total_items}</span>
              </div>
              {order.discount_percent > 0 && (
                <div className="mb-2 flex justify-between text-sm text-green-400">
                  <span>Desconto</span>
                  <span>{order.discount_percent}% (-R$ {fmt(order.discount_cents)})</span>
                </div>
              )}
              <div className="mt-2 flex items-end justify-between border-t border-white/10 pt-2">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-red-400">R$ {fmt(order.total_cents)}</span>
              </div>
            </div>

            {polling && (
              <p className="mt-6 text-center text-xs text-zinc-500">
                Aguardando pagamento... essa página atualiza sozinha.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
