import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import type { LanguageCode } from "@/lib/language";
import { LanguageSelect } from "./LanguageSelect";

type InputTranslateControlsProps = {
  enabled: boolean;
  targetLang: LanguageCode;
  onEnabled: (next: boolean) => void | Promise<void>;
  onTargetLang: (code: LanguageCode) => void | Promise<void>;
};

export function InputTranslateControls({
  enabled,
  targetLang,
  onEnabled,
  onTargetLang
}: InputTranslateControlsProps) {
  return (
    <>
      <Label className="text-muted-foreground font-normal">
        <Checkbox checked={enabled} onCheckedChange={(checked) => void onEnabled(checked === true)} />
        {t("inputTranslate")}
      </Label>
      {enabled ? (
        <div className="space-y-1.5">
          <Label htmlFor="inputTargetLang" className="text-muted-foreground text-xs font-normal">
            {t("inputTargetLanguage")}
          </Label>
          <LanguageSelect
            id="inputTargetLang"
            value={targetLang}
            ariaLabel={t("inputTargetLanguage")}
            onChange={(code) => void onTargetLang(code)}
          />
        </div>
      ) : null}
    </>
  );
}
