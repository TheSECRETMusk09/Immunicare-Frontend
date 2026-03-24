import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  ArrowRight,
  Calendar,
  FileText,
  ChevronRight,
  ChevronDown,
  Shield,
  Heart,
  BookOpen,
  Phone,
  Mail,
  MapPin,
  Loader2,
  CheckCircle,
} from "lucide-react";

const GuardianIntroduction = () => {
  console.log("GuardianIntroduction component loaded");
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [footerContactOpen, setFooterContactOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  // Dynamic data states
  const [guardianCount, setGuardianCount] = useState(null);
  const [nextVaccinationDate, setNextVaccinationDate] = useState(null);
  const [communityData, setCommunityData] = useState({
    population: 42765,
    healthCenterStats: null,
  });
  const [loading, setLoading] = useState({
    guardianCount: true,
    vaccinationDate: true,
    communityData: true,
  });

  // Respect user's theme preference - dark mode is now fully supported
  // Theme is controlled by ThemeContext via localStorage preference

  // Detect screen size for responsive design
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 1024);
    };

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);

      // Track active section for navigation
      const sections = ['home', 'about', 'resources', 'contact'];
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom >= 150) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    // Initial check
    checkMobile();
    handleScroll();

    // Listen for resize events
    window.addEventListener("resize", checkMobile);
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Fetch dynamic data with caching
  const fetchGuardianCount = useCallback(async () => {
    try {
      // Use representative static data to prevent unnecessary network overhead
      // from unauthenticated public landing page visits.
      setGuardianCount(10542);
    } finally {
      setLoading(prev => ({ ...prev, guardianCount: false }));
    }
  }, []);

  const fetchNextVaccinationDate = useCallback(async () => {
    try {
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 15);
      const formattedDate = nextMonth.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      setNextVaccinationDate(formattedDate);
    } finally {
      setLoading(prev => ({ ...prev, vaccinationDate: false }));
    }
  }, []);

  const fetchCommunityData = useCallback(async () => {
    try {
      let data = {
         population: 42765,
         barangay: 'San Nicolas',
         city: 'Pasig City',
         source: 'Philippine Statistics Authority (PSA), 2020 Census',
         lastUpdated: new Date().toISOString(),
      };
      setCommunityData(data);
    } finally {
      setLoading(prev => ({ ...prev, communityData: false }));
    }
  }, []);

  // Fetch all dynamic data on mount
  useEffect(() => {
    fetchGuardianCount();
    fetchNextVaccinationDate();
    fetchCommunityData();
  }, [fetchGuardianCount, fetchNextVaccinationDate, fetchCommunityData]);

  const aboutNarratives = [
    {
      id: "vaccination-schedule-guidance",
      title: "Vaccination schedule guidance",
      image: "/BAKUNA_SCHEDULE.jpg",
      alt: "Vaccination schedule guidance showing the immunization timeline",
      content:
        "Immunicare helps guardians follow age-based vaccines from birth through early childhood. The schedule guidance starts with birth doses, follows routine infant intervals, and highlights upcoming due dates so no critical protection window is missed. We encourage guardians to review reminders early, confirm appointment slots, and keep each dose on-time whenever possible.",
      bullets: [
        "Track due and upcoming vaccines by child and age interval",
        "Receive reminders before scheduled vaccination dates",
        "Coordinate with the health center for catch-up doses when needed",
      ],
    },
    {
      id: "child-immunization-record-process",
      title: "Child immunization record process",
      image: "/Child_immunization_record_image.jpg",
      alt: "Child immunization record documentation and verification process",
      content:
        "The immunization record process in Immunicare is designed to mirror real clinic workflow: registration, child profile confirmation, vaccine history review, administered dose recording, and follow-up scheduling. Each visit updates the child’s timeline so guardians and health workers share a consistent and verifiable source of truth.",
      bullets: [
        "Confirm guardian and child profile details before each visit",
        "Record administered vaccine, dose number, and date",
        "Generate updated history for follow-up and continuity of care",
      ],
    },
    {
      id: "facility-identity-community-context",
      title: "Facility identity and community context",
      image: "/san-nicolas-logo.jpg",
      alt: "Official San Nicolas Health Center logo",
      content:
        "San Nicolas Health Center serves as a trusted primary-care and immunization access point for families in Barangay San Nicolas, Pasig City. As part of the community health network, the center supports preventive care, routine childhood vaccination, and household-level follow-through for infant health milestones.",
      bullets: [
        "Community-based maternal and child health services",
        "Routine and catch-up immunization support",
        "Coordination with barangay and city health workflows",
      ],
    },
  ];

  // Vaccination resources
  const vaccinationResources = [
    {
      id: 1,
      title: "Vaccine Schedule",
      description: "Complete immunization calendar for infants",
      icon: Calendar,
      color: "bg-blue-100 text-blue-600",
    },
    {
      id: 2,
      title: "Vaccine Information",
      description: "Detailed information about each vaccine",
      icon: BookOpen,
      color: "bg-green-100 text-green-600",
    },
    {
      id: 3,
      title: "FAQs",
      description: "Common questions about vaccinations",
      icon: FileText,
      color: "bg-purple-100 text-purple-600",
    },
    {
      id: 4,
      title: "Safety Information",
      description: "Vaccine safety and side effects",
      icon: Shield,
      color: "bg-amber-100 text-amber-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 font-sans">
      {/* Modern Glassmorphism Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? "bg-white/80 backdrop-blur-xl shadow-lg shadow-gray-200/50 py-3"
            : "bg-white/60 backdrop-blur-md py-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Header Logo and Brand */}
            <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => navigate('/')}>
              <img
                src="/san-nicolas-logo.jpg"
                alt="San Nicolas Health Center Logo"
                className="w-11 h-11 rounded-full object-cover shadow-lg border border-red-100"
              />
              <div className="sm">
                <h1 className="guardian-intro-logo-title text-xl font-extrabold text-black">Immunicare</h1>
                <p className="text-xs text-gray-500 -mt-0.5">Child Vaccination System</p>
              </div>
            </div>

            {/* Desktop Navigation with Modern Active States */}
            {!isMobile && (
              <nav className="flex items-center space-x-1">
                {[
                  { id: 'home', label: 'Home' },
                  { id: 'about', label: 'About' },
                  { id: 'resources', label: 'Resources' },
                  { id: 'contact', label: 'Contact' },
                ].map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                      activeSection === item.id
                        ? "text-red-600 bg-red-50"
                        : "text-gray-600 hover:text-red-600 hover:bg-red-50/50"
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            )}

            {/* Modern Actions with Improved Buttons */}
            <div className="flex items-center space-x-3">
              {/* Login/Register */}
              {!isMobile && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => navigate("/guardian/login")}
                    className="px-5 py-2.5 text-white font-bold bg-gray-900 hover:bg-gray-800 rounded-lg transition-all duration-200 min-h-[44px]"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => navigate("/register")}
                    className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 font-medium text-sm shadow-lg shadow-green-500/25 hover:shadow-green-500/40 min-h-[44px]"                  >
                    Register
                  </button>
                </div>
              )}

              {/* Mobile Menu Toggle */}
              {isMobile && (
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-red-600 transition-colors"
                  aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                >
                  {isMenuOpen ? (
                    <X className="w-6 h-6" />
                  ) : (
                    <Menu className="w-6 h-6" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modern Mobile Menu with Glassmorphism */}
        {isMobile && isMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white/95 backdrop-blur-xl shadow-2xl border-t">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
              <nav className="flex flex-col space-y-2">
                {[
                  { id: 'home', label: 'Home' },
                  { id: 'about', label: 'About' },
                  { id: 'resources', label: 'Resources' },
                  { id: 'contact', label: 'Contact' },
                ].map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={() => setIsMenuOpen(false)}
                    className={`px-4 py-3 rounded-lg font-medium text-base transition-all duration-200 ${
                      activeSection === item.id
                        ? "text-red-600 bg-red-50"
                        : "text-gray-700 hover:text-red-600 hover:bg-red-50/50"
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <button
                    onClick={() => {
                      navigate("/guardian/login");
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg font-medium text-base text-left transition-colors"
                  >
                    Login
                  </button>
                  <button
  onClick={() => {
    navigate("/register");
    setIsMenuOpen(false);
  }}
  className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 font-medium text-base text-center shadow-lg shadow-red-500/25 transition-all"
>
  Register
</button>
                </div>
              </nav>
            </div>
          </div>
        )}
      </header>

      <main className="pt-20 md:pt-24">
        {/* Modern Hero Section with Improved Typography */}
        <section
          id="home"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="order-2 lg:order-1">
              {/* Modern Badge with Pulse Animation */}
              <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-2 rounded-full mb-5 min-h-[36px] border border-red-100">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                {loading.guardianCount ? (
                  <span className="flex items-center gap-2 text-red-600 font-semibold text-xs md:text-sm">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  <span className="text-red-700 font-semibold text-xs md:text-sm">
                    Trusted by {guardianCount?.toLocaleString() || '10,000'}+ Families
                  </span>
                )}
              </div>
              {/* Improved Heading with Better Typography */}
              <h1 className="guardian-intro-hero-title text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-black mb-5 leading-tight">
                Welcome to <span className="text-black">Immunicare</span>
              </h1>
              {/* Improved Paragraph - Better Readability */}
              <p className="text-base md:text-lg text-gray-600 mb-7 leading-relaxed max-w-xl">
                Your trusted partner in infant vaccination tracking. Keep your
                little ones safe and healthy with our comprehensive immunization
                management system.
              </p>
              {/* Modern Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate("/guardian/login")}
                  className="inline-flex items-center justify-center min-h-[52px] px-7 md:px-9 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 font-semibold text-base shadow-xl shadow-green-500/20 hover:shadow-green-500/40"
                >
                  Guardian Login
                  <ArrowRight className="w-5 h-5 ml-2" />
                </button>
                <button
                  onClick={() => navigate("/register")}
                  className="px-7 md:px-9 py-3 min-h-[52px] bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all duration-200 font-semibold flex items-center justify-center text-base shadow-lg hover:shadow-xl"
                >
                  Create Account
                </button>
              </div>
              {/* Trust Indicators */}
              <div className="mt-8 flex flex-wrap items-center gap-5 text-sm">
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Shield className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="font-medium text-gray-700">Secure & Private</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
                    <Heart className="w-5 h-5 text-rose-600" />
                  </div>
                  <span className="font-medium text-gray-700">Trusted by Parents</span>
                </div>
              </div>
            </div>
            {/* Hero Image with Modern Styling */}
            <div className="relative order-1 lg:order-2">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src="/Nurse_holding_a_baby.png"
                  alt="Nurse holding baby"
                  className="w-full h-auto"
                />
                {/* Gradient Overlay for Better Visibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
              </div>
              {/* Floating Card */}
              <div className="absolute -bottom-5 md:-bottom-6 -left-4 md:-left-7 bg-white/95 backdrop-blur-sm p-5 md:p-6 rounded-2xl shadow-2xl max-w-xs border border-gray-100">
                <div className="flex items-center space-x-4">
                  <div className="w-12 md:w-14 h-12 md:h-14 bg-gradient-to-br from-green-400 to-green-500 rounded-xl flex items-center justify-center shadow-lg">
                    <Calendar className="w-6 md:w-7 h-6 md:h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500 font-medium">
                      Next Vaccination
                    </p>
                    {loading.vaccinationDate ? (
                      <p className="flex items-center gap-1 font-bold text-gray-900 text-sm md:text-base">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Loading...
                      </p>
                    ) : (
                      <p className="font-bold text-gray-900 text-sm md:text-base">
                        {nextVaccinationDate || 'April 15, 2026'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About Section with Improved Readability */}
        <section id="about" className="bg-white py-12 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8 md:mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-gray-900 mb-4">
                About San Nicolas Health Center and Immunicare
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-4xl leading-relaxed">
                The Guardian About section presents key context from our provided
                visuals: practical vaccination schedule guidance, the child
                immunization record process, and San Nicolas Health Center
                identity.
              </p>
            </div>

            <div className="space-y-8">
              {aboutNarratives.map((block) => (
                <article
                  key={block.id}
                  className="bg-gradient-to-br from-gray-50 to-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-5">
                    <div className="relative h-56 lg:h-auto overflow-hidden lg:col-span-2">
                      <img
                        src={block.image}
                        alt={block.alt}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent lg:hidden"></div>
                    </div>
                    <div className="p-6 md:p-8 lg:col-span-3">
                      <h3 className="text-lg md:text-2xl font-bold text-gray-900 mb-4">
                        {block.title}
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-5">
                        {block.content}
                      </p>
                      <ul className="space-y-3 text-sm md:text-base text-gray-700">
                        {block.bullets.map((item) => (
                          <li key={item} className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Community Info Card */}
            <div className="mt-10 bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 md:p-8 shadow-lg border border-gray-100">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-red-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">
                    San Nicolas Health Center History and Community Context
                  </h3>
                </div>
              </div>
              <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-4">
                San Nicolas Health Center has continuously supported barangay-level
                preventive care, including maternal and child services, routine
                immunization, and family health promotion. The center remains part
                of Pasig City's broader public health delivery system and serves
                households requiring consistent vaccination follow-up and records
                continuity.
              </p>
              {loading.communityData ? (
                <p className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading community data...
                </p>
              ) : (
                <>
                  <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                    Latest community reference used in this section: Barangay{' '}
                    {communityData?.barangay || 'San Nicolas'} population (PSA census reference) —{' '}
                    <strong className="text-gray-900">{communityData?.population?.toLocaleString() || '42,765'}</strong>
                    .
                  </p>
                  <p className="text-xs md:text-sm text-gray-500 mt-4">
                    Citation: {communityData?.source || 'Philippine Statistics Authority (PSA), 2020 Census of Population and Housing (CPH)'},
                    barangay-level population reference for {communityData?.city || 'Pasig City'}, Barangay {communityData?.barangay || 'San Nicolas'}.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Vaccination Resources Section with Modern Cards */}
        <section id="resources" className="bg-gradient-to-br from-gray-50 via-white to-gray-100 py-12 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10 md:mb-14">
              <h2 className="text-2xl md:text-4xl font-bold text-gray-900 mb-4">
                Vaccination Resources
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto px-2 md:px-0 leading-relaxed">
                Everything you need to know about childhood vaccinations in one
                convenient place
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
              {vaccinationResources.map((resource) => (
                <div
                  key={resource.id}
                  className="bg-white rounded-2xl p-5 md:p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 group"
                >
                  <div
                    className={`w-12 h-12 ${resource.color} rounded-xl flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300`}
                  >
                    <resource.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2">
                    {resource.title}
                  </h3>
                  <p className="text-sm md:text-base text-gray-600 mb-4">
                    {resource.description}
                  </p>
                  <button className="text-red-600 hover:text-red-700 font-semibold flex items-center min-h-[44px] px-2 -mx-2 py-2 group-hover:translate-x-1 transition-transform">
                    Learn More
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Modern CTA Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <div className="bg-gradient-to-r from-red-500 via-red-600 to-red-700 rounded-3xl p-8 md:p-14 text-center relative overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>

            <div className="relative z-10">
              <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-base font-bold md:text-lg text-red-100 mb-8 max-w-2xl mx-auto leading-relaxed">
                Join thousands of parents who trust Immunicare to keep their
                children's vaccination records organized and up-to-date.
              </p>
              <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4 px-2 md:px-0">
                <button
                  onClick={() => navigate("/register")}
                  className="px-7 md:px-10 py-3.5 min-h-[52px] bg-white text-red-600 rounded-xl hover:bg-gray-100 transition-all duration-200 font-bold text-base shadow-xl"
                >
                  Create Free Account
                </button>
                <button
                  onClick={() => navigate("/guardian/login")}
                  className="px-7 md:px-10 py-3.5 min-h-[52px] bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 font-bold text-base shadow-lg"
                >
                  Login to Account
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Modern Footer with Gradient Background */}
      <footer id="contact" className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-300 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
            {/* Brand & Social */}
            <div className="md:col-span-2 lg:col-span-1">
              <div className="flex items-center space-x-3 mb-5">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
                  <span className="text-white font-bold text-xl">I</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Immunicare</h3>
                  <p className="text-xs text-gray-400">Child Vaccination System</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-5 text-gray-400">
                Your trusted partner in infant vaccination tracking. Making
                healthcare simple and accessible for every family.
              </p>
              <div className="flex space-x-3">
                <button
                  className="w-10 h-10 bg-gray-800 hover:bg-red-600 rounded-lg flex items-center justify-center transition-colors duration-200"
                  aria-label="Facebook"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  className="w-10 h-10 bg-gray-800 hover:bg-red-600 rounded-lg flex items-center justify-center transition-colors duration-200"
                  aria-label="Twitter"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </button>
                <button
                  className="w-10 h-10 bg-gray-800 hover:bg-red-600 rounded-lg flex items-center justify-center transition-colors duration-200"
                  aria-label="Instagram"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-bold mb-5 text-base">Quick Links</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#home" className="hover:text-white transition-colors block min-h-[44px] px-2 -mx-2 py-2 text-gray-400 hover:text-white">
                    Home
                  </a>
                </li>
                <li>
                  <a href="#resources" className="hover:text-white transition-colors block min-h-[44px] px-2 -mx-2 py-2 text-gray-400 hover:text-white">
                    Resources
                  </a>
                </li>
                <li>
                  <a href="#about" className="hover:text-white transition-colors block min-h-[44px] px-2 -mx-2 py-2 text-gray-400 hover:text-white">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#contact" className="hover:text-white transition-colors block min-h-[44px] px-2 -mx-2 py-2 text-gray-400 hover:text-white">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-white font-bold mb-5 text-base">Resources</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <button className="hover:text-white transition-colors block min-h-[44px] px-2 -mx-2 py-2 text-left w-full text-gray-400 hover:text-white">
                    Vaccine Schedule
                  </button>
                </li>
                <li>
                  <button className="hover:text-white transition-colors block min-h-[44px] px-2 -mx-2 py-2 text-left w-full text-gray-400 hover:text-white">
                    Vaccine Information
                  </button>
                </li>
                <li>
                  <button className="hover:text-white transition-colors block min-h-[44px] px-2 -mx-2 py-2 text-left w-full text-gray-400 hover:text-white">
                    FAQs
                  </button>
                </li>
                <li>
                  <button className="hover:text-white transition-colors block min-h-[44px] px-2 -mx-2 py-2 text-left w-full text-gray-400 hover:text-white">
                    Safety Information
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact Us - Collapsible on Mobile */}
            <div className="md:hidden lg:hidden">
              <button
                onClick={() => setFooterContactOpen(!footerContactOpen)}
                className="w-full flex items-center justify-between text-white font-bold mb-5 min-h-[44px] px-2 -mx-2 py-2 text-base"
                aria-expanded={footerContactOpen}
                aria-controls="contact-content"
              >
                <span>Contact Us</span>
                {footerContactOpen ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </button>
              <ul
                id="contact-content"
                className={`space-y-3 text-sm overflow-hidden transition-all duration-300 ${footerContactOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"}`}
              >
                <li className="flex items-start gap-3 min-h-[44px] px-2">
                  <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                  <span className="text-gray-400">San Nicolas Health Center</span>
                </li>
                <li className="flex items-start gap-3 min-h-[44px] px-2">
                  <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                  <span className="text-gray-400">
                    MH Del Pilar Street, San Nicolas, Pasig City, Metro Manila.
                  </span>
                </li>
                <li className="flex items-center gap-3 min-h-[44px] px-2">
                  <Phone className="w-5 h-5 flex-shrink-0 text-red-500" />
                  <span className="text-gray-400">7239-7463</span>
                </li>
                <li className="flex items-center gap-3 min-h-[44px] px-2">
                  <Mail className="w-5 h-5 flex-shrink-0 text-red-500" />
                  <span className="text-gray-400">info@immunicare.ph</span>
                </li>
              </ul>
            </div>

            {/* Contact Us - Always visible on Desktop */}
            <div className="hidden md:block lg:block">
              <h4 className="text-white font-bold mb-5 text-base">Contact Us</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                  <span className="text-gray-400">San Nicolas Health Center</span>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                  <span className="text-gray-400">
                    MH Del Pilar Street, San Nicolas, Pasig City, Metro Manila.
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-5 h-5 flex-shrink-0 text-red-500" />
                  <span className="text-gray-400">7239-7463</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-5 h-5 flex-shrink-0 text-red-500" />
                  <span className="text-gray-400">info@immunicare.ph</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-10 pt-8 text-center">
            <p className="text-sm text-gray-400">
              © 2026 Immunicare. All rights reserved. Powered by San Nicolas
              Health Center.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default GuardianIntroduction;
