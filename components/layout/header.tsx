import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="flex h-16 items-center justify-between px-4 md:h-18 md:px-6 lg:px-8">
        <h1 className="text-lg font-bold text-foreground md:text-xl lg:text-2xl">
          NovaInsight 資訊科普教育平台
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-base text-foreground md:text-lg">
            學員 ST-01
          </span>
          <Avatar className="size-10 md:size-12">
            <AvatarImage src="/avatar-placeholder.svg" alt="學員頭像" />
            <AvatarFallback className="bg-muted text-base font-medium text-muted-foreground">
              ST
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}

