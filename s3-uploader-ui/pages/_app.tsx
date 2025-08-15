import type { AppProps } from "next/app";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeroUIProvider } from "@heroui/system";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useRouter } from "next/router";

import { fontSans, fontMono } from "@/config/fonts";
import "@/styles/globals.css";
import "react-image-gallery/styles/css/image-gallery.css";
import "@/styles/carousel.css";
import { SideNavProvider } from "@/hooks/useSideNav";

import { AuthProvider, AuthGuard } from "@/lib/auth";

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider navigate={router.push}>
        <NextThemesProvider attribute="class" defaultTheme="light">
          <AuthProvider>
            <AuthGuard>
              <SideNavProvider>
                <Component {...pageProps} />
              </SideNavProvider>
            </AuthGuard>
          </AuthProvider>
        </NextThemesProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
}

export const fonts = {
  sans: fontSans.style.fontFamily,
  mono: fontMono.style.fontFamily,
};
