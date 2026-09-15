-- ============================================================================
-- 0010 — Les liens de paiement d'une commande
--
-- Tara (Dikalo) rend six liens pour un même règlement : lien général, carte,
-- WhatsApp, SMS, Telegram, Dikalo. On les garde sur la commande pour que
-- rouvrir `/abonnement` retrouve le même lien, sans rappeler l'API à chaque
-- affichage — et sans créer un second produit chez le prestataire.
--
-- ⚠️ `subscription_orders` n'a AUCUNE politique d'écriture (0009). Les liens
-- s'y posent donc par une fonction `security definer`, qui n'écrit que sur la
-- commande EN ATTENTE de l'appelant et ne touche ni au statut, ni à la
-- formule, ni à l'échéance.
-- ============================================================================

alter table public.subscription_orders
  add column provider      text,
  add column payment_links jsonb;

comment on column public.subscription_orders.payment_links is
  'Liens rendus par le prestataire. Aucun n''accorde quoi que ce soit : la formule s''ouvre au paiement constaté.';

create or replace function public.attach_payment_links(
  p_reference text,
  p_provider  text,
  p_links     jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_company uuid := public.current_company_id();
begin
  if v_company is null then
    raise exception 'Aucune entreprise pour ce compte.' using errcode = '42501';
  end if;

  if p_provider is null or length(btrim(p_provider)) = 0 then
    raise exception 'Prestataire manquant.' using errcode = '22023';
  end if;

  -- `company_id` ET `status = 'pending'` dans la clause : on ne pose des liens
  -- que sur SA propre commande, et jamais sur une commande déjà réglée. Une
  -- référence appartenant à quelqu'un d'autre ne touche aucune ligne.
  update public.subscription_orders
  set provider = btrim(p_provider),
      payment_links = p_links
  where company_id = v_company
    and reference = p_reference
    and status = 'pending';
end;
$fn$;

revoke all on function public.attach_payment_links(text, text, jsonb) from public;
grant execute on function public.attach_payment_links(text, text, jsonb) to authenticated;
