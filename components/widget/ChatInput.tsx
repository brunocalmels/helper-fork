import { Camera, Mic } from "lucide-react";
import * as motion from "motion/react-client";
import { useCallback, useEffect, useState } from "react";
import { useSpeechRecognition } from "@/components/hooks/useSpeechRecognition";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWidgetCommands, useWidgetTranslations } from "@/components/widget/i18n";
import ShadowHoverButton from "@/components/widget/ShadowHoverButton";
import { useScreenshotStore } from "@/components/widget/widgetState";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { cn } from "@/lib/utils";
import { closeWidget, sendScreenshot } from "@/lib/widget/messages";

type Props = {
  input: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (screenshotData?: string) => void;
  isLoading: boolean;
  isGumroadTheme: boolean;
  placeholder?: string;
};

export default function ChatInput({
  input,
  inputRef,
  handleInputChange,
  handleSubmit,
  isLoading,
  isGumroadTheme,
  placeholder,
}: Props) {
  const { t } = useWidgetTranslations();
  const { closeCommands, screenshotTriggers } = useWidgetCommands();
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [includeScreenshot, setIncludeScreenshot] = useState(false);
  const { screenshot, setScreenshot } = useScreenshotStore();

  const handleSegment = useCallback(
    (segment: string) => {
      const currentInput = inputRef.current?.value || "";

      const event = {
        target: { value: currentInput + segment },
      } as React.ChangeEvent<HTMLTextAreaElement>;

      handleInputChange(event);

      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      });
    },
    [handleInputChange, inputRef],
  );

  const handleError = useCallback((error: string) => {
    captureExceptionAndLog(new Error(`Speech recognition error: ${error}`));
  }, []);

  const { isSupported, isRecording, startRecording, stopRecording } = useSpeechRecognition({
    onSegment: handleSegment,
    onError: handleError,
  });

  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  useEffect(() => {
    if (!input) {
      setShowScreenshot(false);
      setIncludeScreenshot(false);
    } else if (screenshotTriggers.some((keyword: string) => input.toLowerCase().includes(keyword))) {
      setShowScreenshot(true);
    }
  }, [input, screenshotTriggers]);

  useEffect(() => {
    if (screenshot?.response) {
      handleSubmit(screenshot.response);
      setScreenshot(null);
    }
  }, [screenshot]);

  const submit = () => {
    const normalizedInput = input.trim().toLowerCase();
    if (closeCommands.some((cmd: string) => normalizedInput === cmd || normalizedInput.includes(cmd))) {
      closeWidget();
      return;
    }
    if (includeScreenshot) {
      sendScreenshot();
    } else {
      handleSubmit();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="border-t border-black p-4 bg-white">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          stopRecording();
          submit();
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex-1 flex items-start">
          <Textarea
            aria-label={t("ariaLabels.askQuestion")}
            ref={inputRef}
            value={input}
            onChange={(e) => {
              handleInputChange(e);
              adjustTextareaHeight();
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            className="self-stretch max-w-md placeholder:text-muted-foreground text-foreground flex-1 resize-none border-none bg-white p-0 pr-3 outline-none focus:border-none focus:outline-none focus:ring-0 min-h-[24px] max-h-[200px]"
            disabled={isLoading}
          />
          <div className="flex items-center gap-2">
            {isSupported && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={cn("text-primary hover:text-muted-foreground p-2 rounded-full hover:bg-muted", {
                        "bg-muted": isRecording,
                      })}
                      disabled={isLoading}
                      aria-label={isRecording ? t("ariaLabels.stopDictation") : t("ariaLabels.startDictation")}
                    >
                      <Mic
                        className={cn("w-4 h-4", {
                          "text-red-500": isRecording,
                          "text-primary": !isRecording,
                        })}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{isRecording ? t("ui.stop") : t("ui.dictate")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <ShadowHoverButton isLoading={isLoading} isGumroadTheme={isGumroadTheme} />
          </div>
        </div>
        {showScreenshot && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{
              type: "spring",
              stiffness: 600,
              damping: 30,
            }}
            className="flex items-center gap-2"
          >
            <Checkbox
              id="screenshot"
              checked={includeScreenshot}
              onCheckedChange={(e) => setIncludeScreenshot(e === true)}
              className="border-muted-foreground data-[state=checked]:bg-black data-[state=checked]:text-white"
            />
            <label
              htmlFor="screenshot"
              className="cursor-pointer flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Camera className="w-4 h-4" />
              {t("ui.includeScreenshot")}
            </label>
          </motion.div>
        )}
      </form>
    </div>
  );
}
