"use client";

// 文言とボタンだけのダイアログ。ホームの確認・作れなかったとき、ゲームのクリア・失敗で使う
import { useLayoutEffect, useRef } from "react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DialogAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export function MessageDialog({
  title,
  description,
  children,
  actions,
  onDismiss,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
  actions: DialogAction[];
  // Esc で閉じるときに呼ぶ。渡さなければ Esc でも閉じない
  onDismiss?: () => void;
}) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Base UI は、外側に aria-hidden を付けてから(useEffect)フォーカスを中に移すことがあり、
  // 押したボタンにフォーカスが残っているとブラウザが警告を出す。子の useEffect より先に動く
  // useLayoutEffect で、フォーカスのある要素を覚えてから外す(技術ルールの shadcn-tailwind.md)
  useLayoutEffect(() => {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement) {
      returnFocusRef.current = focused;
      focused.blur();
    }
  }, []);

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onDismiss?.();
      }}
    >
      <AlertDialogContent
        // 幅 320px でも左右に余白を残す(モックの p-4)
        className="w-[calc(100%-2rem)]"
        finalFocus={() => returnFocusRef.current ?? true}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-bold">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-700">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        {/* モックと同じく、幅によらずボタンを横に並べる */}
        <AlertDialogFooter className="flex-row">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.primary ? "default" : "outline"}
              className={cn(
                "h-11 flex-1",
                action.primary && "bg-blue-700 text-white hover:bg-blue-800",
              )}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
