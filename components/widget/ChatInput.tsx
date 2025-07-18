import { Camera, Mic, Paperclip, X } from "lucide-react";
import * as motion from "motion/react-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSpeechRecognition } from "@/components/hooks/useSpeechRecognition";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWidgetCommands, useWidgetTranslations } from "@/components/widget/i18n";
import ShadowHoverButton from "@/components/widget/ShadowHoverButton";
import { useScreenshotStore } from "@/components/widget/widgetState";
import { validateClientAttachments } from "@/lib/shared/attachmentValidation";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { cn } from "@/lib/utils";
import { closeWidget, sendScreenshot } from "@/lib/widget/messages";

type Props = {
  input: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (screenshotData?: string, attachments?: File[]) => void;
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const { screenshot, setScreenshot } = useScreenshotStore();

  const pendingAttachmentsRef = useRef<File[]>([]);
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

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
      setSelectedFiles([]);
    } else if (screenshotTriggers.some((keyword: string) => input.toLowerCase().includes(keyword))) {
      setShowScreenshot(true);
    }
  }, [input, screenshotTriggers]);

  useEffect(() => {
    if (screenshot?.response) {
      const pendingAttachments = pendingAttachmentsRef.current;
      pendingAttachmentsRef.current = [];

      handleSubmit(screenshot.response, pendingAttachments.length > 0 ? pendingAttachments : undefined);
      setScreenshot(null);

      // Clean up all object URLs when clearing files
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
      setSelectedFiles([]);
    }
  }, [screenshot, handleSubmit]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  // Memoized object URLs to prevent recreation on every render
  const filePreviewData = useMemo(() => {
    return selectedFiles.map((file) => {
      const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
      let objectUrl = objectUrlsRef.current.get(fileKey);

      if (!objectUrl) {
        objectUrl = URL.createObjectURL(file);
        objectUrlsRef.current.set(fileKey, objectUrl);
      }

      return {
        file,
        objectUrl,
        key: fileKey,
      };
    });
  }, [selectedFiles]);

  const validateAndFilterFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    const validationResult = validateClientAttachments(
      fileArray.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
      })),
      selectedFiles.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
      })),
    );

    if (!validationResult.isValid) {
      setFileError(validationResult.errors.join(", "));
      setTimeout(() => setFileError(null), 5000);
      return [];
    }

    setFileError(null);
    return fileArray.filter((file) => file.type.startsWith("image/"));
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const validFiles = validateAndFilterFiles(files);
      setSelectedFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => {
      const fileToRemove = prev[index];
      if (fileToRemove) {
        // Clean up object URL for removed file
        const fileKey = `${fileToRemove.name}-${fileToRemove.size}-${fileToRemove.lastModified}`;
        const objectUrl = objectUrlsRef.current.get(fileKey);
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrlsRef.current.delete(fileKey);
        }
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = validateAndFilterFiles(files);
    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const submit = () => {
    const normalizedInput = input.trim().toLowerCase();
    if (closeCommands.some((cmd: string) => normalizedInput === cmd || normalizedInput.includes(cmd))) {
      closeWidget();
      return;
    }
    if (includeScreenshot) {
      pendingAttachmentsRef.current = [...selectedFiles];
      sendScreenshot();
    } else {
      handleSubmit(undefined, selectedFiles.length > 0 ? selectedFiles : undefined);

      // Clean up all object URLs when clearing files
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
      setSelectedFiles([]);
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
    <div
      className={cn("border-t border-black p-4 bg-background", {
        "bg-muted": isDragOver,
      })}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          stopRecording();
          submit();
        }}
        className="flex flex-col gap-2 relative"
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
            className="self-stretch max-w-md placeholder:text-muted-foreground text-foreground flex-1 resize-none border-none bg-background p-0 pr-3 outline-none focus:border-none focus:outline-none focus:ring-0 min-h-[24px] max-h-[200px]"
            disabled={isLoading}
          />
          <div className="flex items-center">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label
                    className="text-primary hover:text-muted-foreground p-2 rounded-full hover:bg-muted cursor-pointer"
                    aria-label="Attach images"
                  >
                    <Paperclip className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                      disabled={isLoading}
                    />
                  </label>
                </TooltipTrigger>
                <TooltipContent>Attach images</TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
        {fileError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{
              type: "spring",
              stiffness: 600,
              damping: 30,
            }}
            className="absolute bottom-full left-4 right-4 mb-2 bg-red-50 border border-red-200 rounded-lg p-2 shadow-lg z-50"
          >
            <div className="text-sm text-red-600">{fileError}</div>
          </motion.div>
        )}
        {selectedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{
              type: "spring",
              stiffness: 600,
              damping: 30,
            }}
            className="flex flex-wrap gap-2"
          >
            {filePreviewData.map(({ file, objectUrl, key }, index) => (
              <TooltipProvider key={key} delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative border border-black rounded flex items-center gap-2">
                      <img src={objectUrl} alt={file.name} className="w-10 h-10 object-cover rounded-l" />
                      <div className="text-sm truncate max-w-20 text-black">{file.name}</div>
                      <button
                        type="button"
                        className="p-2 pl-0"
                        onClick={() => removeFile(index)}
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-3 h-3 text-black" />
                      </button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{file.name}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </motion.div>
        )}
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
