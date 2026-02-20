import { CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastProgress,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const icon =
          variant === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
          ) : variant === "destructive" ? (
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          ) : null;

        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-3 w-full">
              {icon}
              <div className="grid gap-1 flex-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            </div>
            {action}
            <ToastClose />
            <ToastProgress variant={variant} duration={5000} />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
