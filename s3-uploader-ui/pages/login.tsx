import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      // redirect to home after login
      router.replace("/");
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Login — s3-uploader</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8" shadow="lg">
          <CardHeader>
            <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
          </CardHeader>

          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email here"
                required
                label="Email"
              />

              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                label="Password"
              />

              <Button
                type="submit"
                disabled={loading}
                isLoading={loading}
                className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardBody>

          <CardFooter>
            {error && <div className="mb-4 text-red-600">{error}</div>}
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
