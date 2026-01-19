import { useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Send, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function InvoiceDetail() {
  const { id } = useParams();
  const { isParent } = useAuth();

  // Placeholder invoice data
  const invoice = {
    id,
    number: 'INV-2024-001',
    status: 'pending',
    student: 'Emma Wilson',
    guardian: 'Sarah Wilson',
    date: '15 January 2024',
    dueDate: '29 January 2024',
    items: [
      { description: 'Piano Lesson (1 hour)', quantity: 4, rate: 45, total: 180 },
      { description: 'Music Theory Book', quantity: 1, rate: 25, total: 25 },
    ],
    subtotal: 205,
    total: 205,
  };

  return (
    <AppLayout>
      <PageHeader
        title={`Invoice ${invoice.number}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: isParent ? 'Invoices & Payments' : 'Invoices', href: '/invoices' },
          { label: invoice.number },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
            {isParent ? (
              <Button className="gap-2">
                <CreditCard className="h-4 w-4" />
                Pay Now
              </Button>
            ) : (
              <Button className="gap-2">
                <Send className="h-4 w-4" />
                Send
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Invoice Details</CardTitle>
                <CardDescription>Created on {invoice.date}</CardDescription>
              </div>
              <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Bill To</div>
                    <div className="mt-1">
                      <div className="font-medium">{invoice.guardian}</div>
                      <div className="text-sm text-muted-foreground">
                        Guardian of {invoice.student}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Due Date</div>
                    <div className="mt-1 font-medium">{invoice.dueDate}</div>
                  </div>
                </div>

                <Separator />

                <div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="pb-3">Description</th>
                        <th className="pb-3 text-right">Qty</th>
                        <th className="pb-3 text-right">Rate</th>
                        <th className="pb-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-3">{item.description}</td>
                          <td className="py-3 text-right">{item.quantity}</td>
                          <td className="py-3 text-right">£{item.rate}</td>
                          <td className="py-3 text-right font-medium">£{item.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <div className="w-48 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>£{invoice.subtotal}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>£{invoice.total}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold">£{invoice.total}</div>
                <div className="mt-1 text-sm text-muted-foreground">Amount due</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
