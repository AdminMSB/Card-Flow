import { requireProfile } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CompraForm } from './compra-form';
import { ComprasTable, type PurchaseListItem } from './compras-table';

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const { data: purchases } = await supabase
    .from('purchases')
    .select('*')
    .order('purchase_date', { ascending: false });

  const { data: costCenters } = await supabase.from('cost_centers').select('id, name').order('name');

  // Cartões visíveis para o formulário: primeiro os próprios cartões ativos; se o usuário
  // não tiver nenhum, caímos para todos os cartões ativos (ex.: cartões "de setor" sem titular fixo).
  const { data: ownCards } = await supabase
    .from('cards')
    .select('id, last_four_digits')
    .eq('holder_id', profile.id)
    .eq('active', true);

  let cards = ownCards ?? [];
  if (cards.length === 0) {
    const { data: activeCards } = await supabase.from('cards').select('id, last_four_digits').eq('active', true);
    cards = activeCards ?? [];
  }

  const costCenterMap = new Map((costCenters ?? []).map((costCenter) => [costCenter.id, costCenter.name]));

  const requesterIds = Array.from(
    new Set((purchases ?? []).map((purchase) => purchase.user_id).filter((id): id is string => !!id)),
  );
  let requesterFullNameById = new Map<string, string>();
  if (requesterIds.length > 0) {
    const { data: requesterProfiles } = await supabase.from('profiles').select('id, full_name').in('id', requesterIds);
    requesterFullNameById = new Map((requesterProfiles ?? []).map((requester) => [requester.id, requester.full_name]));
  }

  const isOwnerException = ['gestor', 'financeiro', 'admin'].includes(profile.role);

  const rows: PurchaseListItem[] = (purchases ?? []).map((purchase) => {
    const isOwner = purchase.user_id === profile.id;
    const isPending = purchase.status === 'pending';
    return {
      ...purchase,
      requesterLabel:
        (purchase.user_id ? requesterFullNameById.get(purchase.user_id) : null) ?? purchase.requester_name ?? '—',
      costCenterName: purchase.cost_center_id ? costCenterMap.get(purchase.cost_center_id) ?? null : null,
      approvalNotes: purchase.approval_notes,
      // Editar: quem registrou a compra, ou gestor/financeiro/admin, enquanto pendente.
      canEdit: isPending && (isOwner || isOwnerException),
      // Excluir: só quem registrou, enquanto pendente.
      canDelete: isPending && isOwner,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Compras</h1>
          <p className="text-sm text-muted-foreground">Registre e acompanhe as despesas do cartão corporativo.</p>
        </div>
        {cards.length > 0 && <CompraForm mode="create" costCenters={costCenters ?? []} cards={cards} />}
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      {cards.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nenhum cartão cadastrado — peça ao financeiro para cadastrar um cartão em Configurações.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Minhas compras</CardTitle>
        </CardHeader>
        <CardContent>
          <ComprasTable rows={rows} costCenters={costCenters ?? []} cards={cards} />
        </CardContent>
      </Card>
    </div>
  );
}
