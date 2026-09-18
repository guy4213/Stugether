"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CHECKS = [
  "Dropdown: נפתח מיושר לימין הכפתור. תת-תפריט נפתח שמאלה. חץ שמאל פותח אותו, חץ ימין סוגר",
  "Popover: מיושר לימין, הטקסט מימין לשמאל",
  "Select: הטקסט והחץ בצד הנכון, הסימון (✓) מימין לפריט",
  "Dialog: ממורכז, כפתור הסגירה (X) בפינה השמאלית העליונה",
  "Toast: מופיע בפינה השמאלית התחתונה, האייקון מימין לטקסט",
];

export function RtlAudit() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">בדיקת RTL — רכיבי Radix</h1>
        <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
          {CHECKS.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      </header>

      <section className="flex flex-wrap gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">תפריט</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>החדר שלי</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>הזמנת משתתפים</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>העוזר</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>הפעלה</DropdownMenuItem>
                <DropdownMenuItem>כיבוי</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem variant="destructive">עזיבת החדר</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">פופאובר</Button>
          </PopoverTrigger>
          <PopoverContent align="start">
            <p className="font-medium">דנה כהן</p>
            <p className="text-sm text-muted-foreground">מדעי המחשב, שנה ב׳</p>
          </PopoverContent>
        </Popover>

        <Select>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="בחירת קורס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="algebra">אלגברה לינארית</SelectItem>
            <SelectItem value="calculus">חדו״א 1</SelectItem>
            <SelectItem value="data-structures">מבני נתונים</SelectItem>
          </SelectContent>
        </Select>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">דיאלוג</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>פתיחת חדר חדש</DialogTitle>
              <DialogDescription>בחרו 1 עד 3 סטודנטים מהקורס.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button>יצירת חדר</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button onClick={() => toast.success("ההזמנה נשלחה לדנה")}>טוסט</Button>
      </section>
    </main>
  );
}
