import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Testimonial } from "@/components/landing/testimonial";
import { AgentFeatures } from "@/components/landing/agent-features";
import { CTA } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Testimonial />
      <AgentFeatures />
      <CTA />
      <Footer />
    </div>
  );
}
