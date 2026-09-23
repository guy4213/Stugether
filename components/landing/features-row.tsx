import { Users2Icon, MonitorPlayIcon, GraduationCapIcon, HandshakeIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  { icon: HandshakeIcon, title: "שיעורים פרטיים", subtitle: "1 על 1 עם מומחים" },
  { icon: Users2Icon, title: "קבוצות לימוד", subtitle: "למדו יחד עם עמיתים" },
  { icon: MonitorPlayIcon, title: "קורסים מקוונים", subtitle: "למידה מובנית" },
  { icon: GraduationCapIcon, title: "מוסדות לימוד", subtitle: "גלו הזדמנויות" },
] as const;

export function FeaturesRow() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="items-center text-center">
            <CardContent className="flex flex-col items-center gap-2 pt-2">
              <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <feature.icon className="size-5" />
              </span>
              <p className="text-sm font-medium">{feature.title}</p>
              <p className="text-xs text-muted-foreground">{feature.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
