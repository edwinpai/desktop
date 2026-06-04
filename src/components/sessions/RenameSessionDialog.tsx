import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface RenameSessionDialogProps {
  open: boolean;
  currentLabel: string;
  onOpenChange: (open: boolean) => void;
  onRename: (userLabel: string | null) => void;
}

export function RenameSessionDialog({
  open,
  currentLabel,
  onOpenChange,
  onRename,
}: RenameSessionDialogProps) {
  const [value, setValue] = useState(currentLabel);

  useEffect(() => {
    if (open) setValue(currentLabel);
  }, [currentLabel, open]);

  const submit = () => {
    const trimmed = value.trim();
    onRename(trimmed ? trimmed : null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename session</DialogTitle>
          <DialogDescription>
            Set a custom label for this session. Leave it blank to use the
            generated title.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          <Input
            autoFocus
            aria-label="Session name"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Session name"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Rename</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
