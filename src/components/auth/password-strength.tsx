"use client";

type Strength = "fraca" | "media" | "forte";

function getStrength(password: string): Strength {
  if (password.length < 8) return "fraca";
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  if (hasNumber && hasSpecial && hasUpper) return "forte";
  if (hasNumber || hasSpecial) return "media";
  return "fraca";
}

const strengthConfig: Record<
  Strength,
  { label: string; color: string; width: string }
> = {
  fraca: { label: "Fraca", color: "bg-red-500", width: "w-1/3" },
  media: { label: "Media", color: "bg-yellow-500", width: "w-2/3" },
  forte: { label: "Forte", color: "bg-green-500", width: "w-full" },
};

type Props = {
  password: string;
};

export function PasswordStrength({ password }: Props) {
  if (!password) return null;

  const strength = getStrength(password);
  const config = strengthConfig[strength];

  return (
    <div className="space-y-1">
      <div className="h-1 w-full rounded-full bg-[#e5e5e5]">
        <div
          className={`h-1 rounded-full transition-all duration-300 ${config.color} ${config.width}`}
        />
      </div>
      <p className="text-xs text-[#787774]">Senha {config.label}</p>
    </div>
  );
}
