import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sortedLanguages, t } from "@/lib/i18n";
import { isSupportedLang, type LanguageCode } from "@/lib/language";
import { cn } from "@/lib/utils";

type LanguageSelectProps = {
  value: string;
  onChange: (code: LanguageCode) => void;
  className?: string;
  id?: string;
  ariaLabel?: string;
};

export function LanguageSelect({ value, onChange, className, id, ariaLabel }: LanguageSelectProps) {
  const options = useMemo(() => sortedLanguages(), []);
  const label = ariaLabel ?? t("targetLanguage");
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (isSupportedLang(next)) onChange(next);
      }}
    >
      <SelectTrigger id={id} className={cn("w-full", className)} aria-label={label} title={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(({ code, name }) => (
          <SelectItem key={code} value={code}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
