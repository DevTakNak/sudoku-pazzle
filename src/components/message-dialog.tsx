"use client";

// 文言とボタンだけのダイアログ。ホームの確認・作れなかったとき、ゲームのクリア・失敗で使う
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { useLayoutEffect, useRef } from "react";

import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
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
    // StrictMode(開発のときだけ)の付け直しでは、外した後の body を覚え直さない
    if (returnFocusRef.current !== null) return;
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
      {/* shadcn/ui の AlertDialogContent は、狭い幅での中央寄せ、ボタンの帯、背景のぼかしが
          モックと違い、背景の指定も渡せないので、部品を組み合わせてモックの見た目にする */}
      <AlertDialogPortal>
        <AlertDialogOverlay className="bg-black/50 supports-backdrop-filter:backdrop-blur-none" />
        <AlertDialogPrimitive.Popup
          // 幅 320px でも左右に余白を残す(モックの p-4)
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          finalFocus={() => returnFocusRef.current ?? true}
        >
          <AlertDialogTitle className="text-lg font-bold">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-wrap text-gray-700">
            {description}
          </AlertDialogDescription>
          {children && <div className="mt-4">{children}</div>}
          {/* モックと同じく、幅によらずボタンを横に並べる */}
          <div className="mt-5 flex gap-2">
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
          </div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
