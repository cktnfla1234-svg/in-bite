import { WelcomeModal } from "./WelcomeModal";
type AuthFormMode = "default" | "sign-up" | "log-in";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  initialAuthView?: boolean;
  initialMode?: AuthFormMode;
};

export function AuthModal({
  open,
  onClose,
  initialAuthView = false,
  initialMode = "default",
}: AuthModalProps) {
  return (
    <WelcomeModal
      open={open}
      onClose={onClose}
      onAuthenticated={onClose}
      onSecondary={onClose}
      initialAuthView={initialAuthView}
      initialMode={initialMode}
    />
  );
}

