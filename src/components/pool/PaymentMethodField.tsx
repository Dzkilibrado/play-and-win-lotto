/**
 * Seletor único de forma de pagamento, reutilizado no cadastro de
 * participante e no registro de pagamento posterior.
 * Os valores enviados ao banco são sempre canônicos (PIX/CASH/CARD/OTHER).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  paymentMethodLabel,
  paymentMethods,
  type PaymentMethod,
} from "@/config/pools.config";

export function PaymentMethodField({
  idPrefix,
  method,
  description,
  onMethodChange,
  onDescriptionChange,
  disabled,
}: {
  idPrefix: string;
  method: PaymentMethod;
  description: string;
  onMethodChange: (value: PaymentMethod) => void;
  onDescriptionChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-method`}>Forma de pagamento</Label>
        <Select
          value={method}
          onValueChange={(value) => onMethodChange(value as PaymentMethod)}
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-method`} className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {paymentMethods.map((option) => (
              <SelectItem key={option} value={option}>
                {paymentMethodLabel[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {method === "OTHER" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-method-description`}>Qual forma?</Label>
          <Input
            id={`${idPrefix}-method-description`}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            className="h-11"
            placeholder="Ex.: transferência bancária"
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Validação compartilhada: só "Outro" exige descrição. */
export function validatePaymentMethod(
  method: PaymentMethod,
  description: string,
): string | null {
  if (method === "OTHER" && !description.trim()) return "Descreva a forma de pagamento.";
  return null;
}
