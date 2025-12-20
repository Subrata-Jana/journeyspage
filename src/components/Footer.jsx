import React from "react";
import { Link } from "react-router-dom";
import { 
  Compass, Facebook, Instagram, Twitter, Youtube, 
  ArrowRight, Heart, Globe, ShieldCheck, Send 
} from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-white dark:bg-[#0B0F19] text-slate-900 dark:text-white pt-24 pb-12 overflow-hidden transition-colors duration-500">
      
      {/* 1. Ambient Background Glows (Premium Touch) */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* 2. Top Section: Big CTA & Newsletter */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-12 mb-20">
          
          {/* Brand & Mission */}
          <div className="max-w-xl">
            <Link to="/" className="flex items-center gap-3 mb-6 group w-fit">
              <div className="p-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl shadow-xl group-hover:scale-110 transition-transform duration-300">
                  <Compass size={28} />
              </div>
              <span className="font-bold text-3xl tracking-tight text-slate-900 dark:text-white">
                  Journeys<span className="text-orange-500">Page</span>
              </span>
            </Link>
            <h2 className="text-4xl md:text-5xl font-black leading-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-500 dark:from-white dark:to-slate-500">
              Explore the unseen.<br />Share the unforgettable.
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
              Join a community of modern explorers documenting the world's most breathtaking destinations.
            </p>
          </div>

          {/* Premium Newsletter Input */}
          <div className="w-full lg:w-auto min-w-[350px]">
            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-1.5 rounded-2xl flex items-center focus-within:ring-2 focus-within:ring-orange-500/50 transition-all shadow-sm">
                <input 
                  type="email" 
                  placeholder="Your email address" 
                  className="bg-transparent border-none px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none w-full font-medium"
                />
                <button className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-3.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg">
                   <ArrowRight size={20} />
                </button>
            </div>
            <p className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
               <ShieldCheck size={12} className="text-green-500"/> No spam. Unsubscribe anytime.
            </p>
          </div>
        </div>

        {/* 3. Divider */}
        <div className="h-px w-full bg-slate-100 dark:bg-white/5 mb-16" />

        {/* 4. Links Grid (Clean Typography) */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 mb-20">
            <div className="col-span-2 lg:col-span-2">
                <h4 className="font-bold text-lg mb-6">Socials</h4>
                <div className="flex gap-4">
                   <SocialIcon icon={<Facebook size={20}/>} href="#" />
                   <SocialIcon icon={<Instagram size={20}/>} href="#" />
                   <SocialIcon icon={<Twitter size={20}/>} href="#" />
                   <SocialIcon icon={<Youtube size={20}/>} href="#" />
                </div>
            </div>
            
            <FooterColumn 
              title="Discover" 
              links={[
                { label: "Trending Stories", to: "/search" },
                { label: "Featured Guides", to: "/guides" },
                { label: "New Destinations", to: "/new" },
                { label: "Community Picks", to: "/picks" }
              ]} 
            />
            <FooterColumn 
              title="Company" 
              links={[
                { label: "About Us", to: "/about" },
                { label: "Careers", to: "/careers" },
                { label: "Press Kit", to: "/press" },
                { label: "Contact", to: "/contact" }
              ]} 
            />
            <FooterColumn 
              title="Legal" 
              links={[
                { label: "Privacy Policy", to: "/privacy" },
                { label: "Terms of Service", to: "/terms" },
                { label: "Cookie Policy", to: "/cookies" },
                { label: "Security", to: "/security" }
              ]} 
            />
        </div>

        {/* 5. Bottom Bar (Minimalist) */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-8 border-t border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-500 text-sm font-medium">
            <span>&copy; {currentYear} JourneysPage Inc.</span>
            <span className="hidden md:inline text-slate-300 dark:text-slate-700">|</span>
            <span className="hidden md:inline">All rights reserved.</span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 px-3 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors">
                <Globe size={14} /> <span>English (US)</span>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}

// --- COMPONENTS ---

const FooterColumn = ({ title, links }) => (
  <div className="flex flex-col gap-4">
    <h4 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">{title}</h4>
    <ul className="flex flex-col gap-3">
      {links.map((link, i) => (
        <li key={i}>
          <Link 
            to={link.to} 
            className="text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-white transition-colors text-[15px] font-medium hover:translate-x-1 inline-block duration-200"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

const SocialIcon = ({ icon, href }) => (
  <a 
    href={href} 
    className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-orange-500 hover:text-white dark:hover:bg-white dark:hover:text-black transition-all duration-300 hover:-translate-y-1"
  >
    {icon}
  </a>
);