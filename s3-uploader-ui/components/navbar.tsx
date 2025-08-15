import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
} from "@heroui/navbar";
import { Link } from "@heroui/link";
import { link as linkStyles } from "@heroui/theme";
import NextLink from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import { Button } from "@heroui/button";
import { FolderTree } from "lucide-react";

import { SideNavBar } from "./side-nav-bar";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { GithubIcon } from "@/components/icons";
import { useSideNavBar } from "@/hooks/useSideNav";
import { useAuth } from "@/lib/auth";

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "";

export const Navbar = () => {
  const { toggleSideNav } = useSideNavBar();
  const router = useRouter();

  const { logout: clientLogout } = useAuth();

  const handleLogout = async () => {
    try {
      // call backend to clear CloudFront cookies (credentials included)
      await fetch(`${BACKEND_API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // console.warn("Logout request failed", err);
    } finally {
      // clear client-side auth state and redirect to login
      clientLogout();
      router.replace("/login");
    }
  };

  // const searchInput = (
  //   <Input
  //     aria-label="Search"
  //     classNames={{
  //       inputWrapper: "bg-default-100",
  //       input: "text-sm",
  //     }}
  //     endContent={
  //       <Kbd className="hidden lg:inline-block" keys={["command"]}>
  //         K
  //       </Kbd>
  //     }
  //     labelPlacement="outside"
  //     placeholder="Search..."
  //     startContent={
  //       <SearchIcon className="text-base text-default-400 pointer-events-none flex-shrink-0" />
  //     }
  //     type="search"
  //   />
  // );
  return (
    <HeroUINavbar maxWidth="xl" position="sticky">
      <SideNavBar />

      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <Button isIconOnly variant="light" onPress={toggleSideNav}>
          <FolderTree />
        </Button>
        <NavbarBrand className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1" href="/">
            <p className="font-bold text-inherit">File Manager</p>
          </NextLink>
        </NavbarBrand>
        <div className="hidden lg:flex gap-4 justify-start ml-2">
          {siteConfig.navItems.map((item) => (
            <NavbarItem key={item.href}>
              <NextLink
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "data-[active=true]:text-primary data-[active=true]:font-medium",
                )}
                color="foreground"
                data-active={router.asPath === item.href}
                href={item.href}
              >
                {item.label}
              </NextLink>
            </NavbarItem>
          ))}
        </div>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2">
          <Link isExternal href={siteConfig.links.github} title="GitHub">
            <GithubIcon className="text-default-500" />
          </Link>
          <ThemeSwitch />
          <Button variant="ghost" onPress={handleLogout}>
            Logout
          </Button>
        </NavbarItem>
        {/* <NavbarItem className="hidden lg:flex">{searchInput}</NavbarItem> */}
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <Link isExternal href={siteConfig.links.github}>
          <GithubIcon className="text-default-500" />
        </Link>
        <ThemeSwitch />
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu>
        {/* {searchInput} */}
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {siteConfig.navMenuItems.map((item, index) => (
            <NavbarMenuItem key={`${item}-${index}`}>
              <NextLink
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "data-[active=true]:text-primary data-[active=true]:font-medium",
                )}
                color="foreground"
                data-active={router.asPath === item.href}
                href={item.href}
              >
                {item.label}
              </NextLink>
            </NavbarMenuItem>
          ))}

          <NavbarMenuItem>
            <button
              className="w-full text-left px-2 py-1 rounded hover:bg-default-100"
              onClick={() => handleLogout()}
            >
              Logout
            </button>
          </NavbarMenuItem>
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
