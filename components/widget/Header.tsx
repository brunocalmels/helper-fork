import { History, Maximize2, Minimize2, X } from "lucide-react";
import React from "react";
import { HelperWidgetConfig } from "@helperai/sdk";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWidgetTranslations } from "@/components/widget/i18n";
import { closeWidget, toggleWidgetHeight } from "@/lib/widget/messages";

export type WidgetHeaderConfig = HelperWidgetConfig & {
  isMinimized?: boolean;
};

type Props = {
  config: WidgetHeaderConfig;
  onShowPreviousConversations: () => void;
  onNewConversation: () => void;
  title: React.ReactNode;
};

const NewChatIcon = React.memo(() => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" />
    <path d="M8 12H16M12 8V16" strokeWidth="2" strokeLinecap="round" style={{ stroke: "var(--background)" }} />
  </svg>
));

const Header = React.memo(function Header({ config, onShowPreviousConversations, onNewConversation, title }: Props) {
  const { t } = useWidgetTranslations();
  const [isMinimized, setIsMinimized] = React.useState(() => {
    return config.isMinimized === true;
  });

  React.useEffect(() => {
    setIsMinimized(config.isMinimized === true);
  }, [config.isMinimized]);

  const handleToggleHeight = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    toggleWidgetHeight();
  };

  const shouldShowMinimizeButton = config.viewportWidth ? config.viewportWidth >= 640 : true;

  return (
    <div className="flex items-start justify-between border-b border-black p-1.5">
      <div className="flex items-center h-full">
        <div className="ml-2 flex flex-col gap-0.5">
          <h2 className="text-base leading-5 text-foreground">{title}</h2>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="text-primary hover:text-muted-foreground p-1 rounded-full hover:bg-muted"
                onClick={onNewConversation}
                aria-label={t("ariaLabels.startNewConversation")}
              >
                <NewChatIcon />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("ui.newConversation")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="text-primary hover:text-muted-foreground p-1 rounded-full hover:bg-muted"
                onClick={onShowPreviousConversations}
                aria-label={t("ariaLabels.showPreviousConversations")}
              >
                <History className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("ui.history")}</TooltipContent>
          </Tooltip>
          {shouldShowMinimizeButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="text-primary hover:text-muted-foreground p-1 rounded-full hover:bg-muted"
                  onClick={handleToggleHeight}
                  aria-label={isMinimized ? t("ariaLabels.maximizeWidget") : t("ariaLabels.minimizeWidget")}
                >
                  {isMinimized ? <Maximize2 className="h-5 w-5" /> : <Minimize2 className="h-5 w-5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{isMinimized ? t("ui.maximize") : t("ui.minimize")}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="text-primary hover:text-muted-foreground p-1 rounded-full hover:bg-muted"
                onClick={() => closeWidget()}
                aria-label={t("ariaLabels.closeChat")}
              >
                <X className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("ui.closeChat")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
});

export default Header;
