import { signIn } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; redirectTo?: string };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conciliação de Cartão Corporativo</CardTitle>
        <CardDescription>Entre com seu e-mail e senha corporativos.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signIn} className="flex flex-col gap-4">
          <input type="hidden" name="redirectTo" value={searchParams.redirectTo ?? '/dashboard'} />
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
