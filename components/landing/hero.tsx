"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function Hero() {
  return (
    <section className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-background py-2 sm:py-3">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative h-[98dvh] w-[98%] max-w-[1600px] overflow-hidden rounded-2xl sm:rounded-3xl"
      >
        {/* Background image */}
        <Image
          src="/hero.jpg"
          alt="TNGC Institute campus"
          fill
          priority
          sizes="98vw"
          className="object-cover object-center"
        />

        {/* Overlays */}
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col">
          {/* Hero text — centered in the available space */}
          <div className="flex flex-1 items-center justify-center px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                className="text-balance text-3xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-5xl lg:text-6xl xl:text-7xl"
              >
                The New Generation{" "}
                <span className="text-primary">Computers</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35, ease: "easeOut" }}
                className="mx-auto mt-4 max-w-xl text-pretty text-sm text-white/85 sm:text-base lg:text-lg"
              >
                Job-Oriented Computer Training with 24+ years of excellence.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
                className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
              >
                <Link
                  href="/auth/user/login"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "group w-full gap-2 px-6 text-sm shadow-lg transition-transform hover:scale-[1.02] sm:w-auto"
                  )}
                >
                  Sign In
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/#features"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "w-full border-white/30 bg-white/5 px-6 text-sm text-white backdrop-blur-sm transition-all hover:scale-[1.02] hover:border-white/50 hover:bg-white/15 hover:text-white sm:w-auto"
                  )}
                >
                  About Us
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}