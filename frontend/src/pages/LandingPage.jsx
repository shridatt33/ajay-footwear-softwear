import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SHOP_INFO } from '../config'
import {
  ShoeLogo,
  BillIcon,
  ProductIcon,
  StockIcon,
  CustomerIcon,
  SalesIcon,
  PurchaseIcon,
  BarcodeNavIcon,
  ReportIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  CheckIcon,
  LockIcon,
} from '../components/Icons'
import './LandingPage.css'

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const scrollToSection = (e, id) => {
    e.preventDefault()
    setMobileMenuOpen(false)
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="landing-page" id="home">
      {/* ====================================================================
          1. NAVBAR
          ==================================================================== */}
      <header className="landing-navbar">
        <div className="landing-container landing-navbar-inner">
          {/* Brand Logo & Name */}
          <a href="#home" className="landing-brand" onClick={(e) => scrollToSection(e, 'home')}>
            <img
              src="/Swamidatt_Agency.png"
              alt="SWAMIDATT FOOTWEAR"
              className="landing-brand-logo"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <div className="landing-brand-text">
              <span className="landing-brand-title">{SHOP_INFO.name}</span>
              <span className="landing-brand-subtitle">Swamidatt Agency</span>
            </div>
          </a>

          {/* Navigation Links */}
          <nav>
            <ul className={`landing-nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
              <li>
                <a href="#home" className="landing-nav-link" onClick={(e) => scrollToSection(e, 'home')}>
                  Home
                </a>
              </li>
              <li>
                <a href="#about" className="landing-nav-link" onClick={(e) => scrollToSection(e, 'about')}>
                  About Us
                </a>
              </li>
              <li>
                <a href="#services" className="landing-nav-link" onClick={(e) => scrollToSection(e, 'services')}>
                  Our Services
                </a>
              </li>
              <li>
                <a href="#software" className="landing-nav-link" onClick={(e) => scrollToSection(e, 'software')}>
                  POS Software
                </a>
              </li>
              <li>
                <a href="#contact" className="landing-nav-link" onClick={(e) => scrollToSection(e, 'contact')}>
                  Contact
                </a>
              </li>
            </ul>
          </nav>

          {/* Right Action: Login to Dashboard */}
          <div className="landing-nav-actions">
            <Link to="/login" className="btn-nav-login" id="nav-login-button" title="Access Store ERP & POS Terminal">
              <LockIcon size={16} />
              <span>Login to Dashboard</span>
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              className="landing-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileMenuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ====================================================================
          2. HERO SECTION
          ==================================================================== */}
      <section className="landing-hero">
        <div className="landing-container landing-hero-grid">
          {/* Left Content */}
          <div className="hero-content-col">
            <div className="hero-pill-badge">
              <span className="hero-pill-dot" />
              <span>Swamidatt Agency &bull; Quality &amp; Comfort</span>
            </div>

            <h1 className="hero-main-title">
              Welcome to <span className="hero-highlight">{SHOP_INFO.name}</span>
            </h1>

            <h2 className="hero-subheadline">
              Your Trusted Footwear Destination — Quality, Comfort and Style.
            </h2>

            <p className="hero-description">
              Swamidatt Agency is a premier footwear retail destination dedicated to bringing customers superior
              comfort, enduring quality, and stylish footwear choices for everyday wear, work, and special occasions.
              We combine curated collections with personalized service and modern digital operations.
            </p>

            {/* Hero CTAs */}
            <div className="hero-cta-group">
              <a
                href="#services"
                className="btn-primary-hero"
                onClick={(e) => scrollToSection(e, 'services')}
              >
                <ShoppingBagIcon size={18} />
                <span>Explore Our Shop</span>
              </a>

              <Link to="/login" className="btn-secondary-hero" id="hero-login-button">
                <LockIcon size={16} />
                <span>Login to Dashboard</span>
              </Link>
            </div>

            {/* Highlight Chips */}
            <div className="hero-features-chips">
              <div className="hero-chip-item">
                <span className="hero-chip-icon"><CheckIcon size={16} /></span>
                <span>Quality Footwear Selection</span>
              </div>
              <div className="hero-chip-item">
                <span className="hero-chip-icon"><CheckIcon size={16} /></span>
                <span>Personalized Fitting</span>
              </div>
              <div className="hero-chip-item">
                <span className="hero-chip-icon"><CheckIcon size={16} /></span>
                <span>Transparent Invoicing</span>
              </div>
            </div>
          </div>

          {/* Right Hero Visual */}
          <div className="hero-visual-wrapper">
            <div className="hero-image-frame">
              <img
                src="/footwear_hero.jpg"
                alt="SWAMIDATT FOOTWEAR Collection Showcase"
                loading="eager"
              />
            </div>

            {/* Floating Highlights */}
            <div className="floating-stat-badge bottom-left">
              <div className="badge-icon-box">
                <ShoeLogo small />
              </div>
              <div className="badge-text-group">
                <h5>100% Quality Assurance</h5>
                <p>Comfort soles &amp; durable materials</p>
              </div>
            </div>

            <div className="floating-stat-badge top-right">
              <div className="badge-icon-box">
                <ShieldCheckIcon size={20} />
              </div>
              <div className="badge-text-group">
                <h5>Swamidatt Agency</h5>
                <p>GST Registered: {SHOP_INFO.gst}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          3. ABOUT US SECTION
          ==================================================================== */}
      <section className="landing-section" id="about">
        <div className="landing-container">
          <div className="section-header-block">
            <span className="section-eyebrow">Our Business &amp; Commitment</span>
            <h2 className="section-title">About Swamidatt Agency</h2>
            <p className="section-subtitle">
              Dedicated to offering dependable footwear choices with an uncompromising focus on comfort, quality, and personalized customer care.
            </p>
          </div>

          <div className="about-grid">
            {/* Left Narrative Box */}
            <div className="about-card-left">
              <p className="about-text-lead">
                At Swamidatt Agency, footwear is more than just footwear — it is the foundation of comfort, active health, and personal confidence.
              </p>
              <p className="about-paragraph">
                As an established retail footwear destination operating in Maharashtra, we take pride in presenting a diverse range of footwear curated to meet the daily requirements of men, women, and children. Whether you require formal office wear, casual weekend shoes, durable sports footwear, or comfortable daily slippers, our shop is committed to helping you find the right fit.
              </p>
              <p className="about-paragraph">
                We believe in straightforward, honest customer service. Every item in our store is selected for construction durability, proper arch support, and high aesthetic appeal.
              </p>

              {/* Verified Store Details */}
              <div className="about-verified-info-strip">
                <div className="verified-info-row">
                  <span className="verified-label">Business:</span>
                  <span className="verified-value">{SHOP_INFO.name} (Swamidatt Agency)</span>
                </div>
                <div className="verified-info-row">
                  <span className="verified-label">Location:</span>
                  <span className="verified-value">{SHOP_INFO.address}</span>
                </div>
                <div className="verified-info-row">
                  <span className="verified-label">Helpline:</span>
                  <span className="verified-value">{SHOP_INFO.phone}</span>
                </div>
                <div className="verified-info-row">
                  <span className="verified-label">GSTIN:</span>
                  <span className="verified-value">{SHOP_INFO.gst}</span>
                </div>
              </div>
            </div>

            {/* Right Value Pillars */}
            <div className="about-pillars-column">
              <div className="about-pillar-card">
                <div className="pillar-icon-box">
                  <ShoeLogo small />
                </div>
                <div className="pillar-content">
                  <h4>Quality &amp; Durability</h4>
                  <p>
                    Footwear built with resilient soles, breathable linings, and premium stitching to ensure long-lasting satisfaction and daily comfort.
                  </p>
                </div>
              </div>

              <div className="about-pillar-card">
                <div className="pillar-icon-box">
                  <CustomerIcon size={22} />
                </div>
                <div className="pillar-content">
                  <h4>Dedicated Sizing Assistance</h4>
                  <p>
                    Attentive guidance to help every customer find the exact size and fit, supporting proper posture and comfortable movement.
                  </p>
                </div>
              </div>

              <div className="about-pillar-card">
                <div className="pillar-icon-box">
                  <ShieldCheckIcon size={22} />
                </div>
                <div className="pillar-content">
                  <h4>Reliable &amp; Transparent</h4>
                  <p>
                    Registered footwear retail operations with clear itemized invoicing, authentic pricing, and dependable exchange policies.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          4. OUR SERVICES SECTION
          ==================================================================== */}
      <section className="landing-section section-bg-light" id="services">
        <div className="landing-container">
          <div className="section-header-block">
            <span className="section-eyebrow">Comprehensive Solutions</span>
            <h2 className="section-title">Our Services</h2>
            <p className="section-subtitle">
              Delivering footwear retail excellence for our customers alongside structured operational workflows for our store.
            </p>
          </div>

          {/* Group 1: Customer-Facing Retail Services */}
          <div className="services-category-block">
            <div className="services-category-heading">
              <span className="category-tag-badge">For Shoppers</span>
              <h3>Customer-Facing Footwear Services</h3>
            </div>

            <div className="services-grid-3">
              {/* Card 1: Footwear Collection */}
              <div className="service-card">
                <div className="service-card-header">
                  <div className="service-icon-box">
                    <ShoppingBagIcon size={22} />
                  </div>
                  <h4>Footwear Collection</h4>
                </div>
                <p>
                  A versatile collection spanning formal leather shoes, modern sneakers, sports joggers, comfort sandals, and children's sizes tailored for comfort and durability.
                </p>
                <ul className="service-card-features">
                  <li><span className="feature-check">&bull;</span> Men’s, Women’s, and Kids’ footwear choices</li>
                  <li><span className="feature-check">&bull;</span> Formal, casual, athletic, and traditional styles</li>
                  <li><span className="feature-check">&bull;</span> Broad size range with comfort sole engineering</li>
                </ul>
              </div>

              {/* Card 2: Customer Service */}
              <div className="service-card">
                <div className="service-card-header">
                  <div className="service-icon-box">
                    <CustomerIcon size={22} />
                  </div>
                  <h4>Customer Service</h4>
                </div>
                <p>
                  Personalized attention from our knowledgeable in-store staff to help you evaluate sizing, recommend styles, and ensure a comfortable shopping visit.
                </p>
                <ul className="service-card-features">
                  <li><span className="feature-check">&bull;</span> Personalized size measurement and fit check</li>
                  <li><span className="feature-check">&bull;</span> Style matching for work, casual, and formal needs</li>
                  <li><span className="feature-check">&bull;</span> Responsive in-store customer support</li>
                </ul>
              </div>

              {/* Card 3: Billing and Invoicing */}
              <div className="service-card">
                <div className="service-card-header">
                  <div className="service-icon-box">
                    <BillIcon size={22} />
                  </div>
                  <h4>Billing &amp; Invoicing</h4>
                </div>
                <p>
                  Transparent retail checkout with accurate itemized tax invoices, clear pricing without hidden charges, and instant digital receipt records.
                </p>
                <ul className="service-card-features">
                  <li><span className="feature-check">&bull;</span> GST-compliant tax invoices and receipts</li>
                  <li><span className="feature-check">&bull;</span> Instant thermal receipt and A4 print options</li>
                  <li><span className="feature-check">&bull;</span> Multiple payment modes accepted</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Group 2: Internal Shop Management & Operations */}
          <div className="services-category-block" style={{ marginBottom: 0 }}>
            <div className="services-category-heading">
              <span className="category-tag-badge">Shop Operations</span>
              <h3>Store Management &amp; Operational Capabilities</h3>
            </div>

            <div className="services-grid-3">
              {/* Card 4: Product Management */}
              <div className="service-card">
                <div className="service-card-header">
                  <div className="service-icon-box">
                    <ProductIcon size={22} />
                  </div>
                  <h4>Product Management</h4>
                </div>
                <p>
                  Structured catalog management tracking footwear models, size matrices, unique product codes, and purchase costs for seamless store maintenance.
                </p>
                <ul className="service-card-features">
                  <li><span className="feature-check">&bull;</span> Centralized product and size variant catalog</li>
                  <li><span className="feature-check">&bull;</span> Category and brand categorization</li>
                  <li><span className="feature-check">&bull;</span> Systematized pricing and cost tracking</li>
                </ul>
              </div>

              {/* Card 5: Inventory & Stock Management */}
              <div className="service-card">
                <div className="service-card-header">
                  <div className="service-icon-box">
                    <StockIcon size={22} />
                  </div>
                  <h4>Inventory &amp; Stock</h4>
                </div>
                <p>
                  Real-time size-by-size inventory tracking to ensure popular footwear sizes remain in stock and stock replenishments are scheduled on time.
                </p>
                <ul className="service-card-features">
                  <li><span className="feature-check">&bull;</span> Real-time size-wise quantity monitoring</li>
                  <li><span className="feature-check">&bull;</span> Out-of-stock and low-stock alerts</li>
                  <li><span className="feature-check">&bull;</span> Purchase inward stock reconciliation</li>
                </ul>
              </div>

              {/* Card 6: Sales Reports & Analysis */}
              <div className="service-card">
                <div className="service-card-header">
                  <div className="service-icon-box">
                    <ReportIcon size={22} />
                  </div>
                  <h4>Sales Reports &amp; Analysis</h4>
                </div>
                <p>
                  Data-driven insights into sales performance, revenue patterns, top-selling footwear designs, and financial summaries for informed decision-making.
                </p>
                <ul className="service-card-features">
                  <li><span className="feature-check">&bull;</span> Daily, weekly, and monthly sales summaries</li>
                  <li><span className="feature-check">&bull;</span> Fast-moving footwear item analytics</li>
                  <li><span className="feature-check">&bull;</span> Comprehensive financial and tax overview</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          5. SOFTWARE INTRODUCTION SECTION
          ==================================================================== */}
      <section className="landing-section" id="software">
        <div className="landing-container">
          {/* Software Hero Banner */}
          <div className="software-hero-banner">
            <div>
              <div className="software-banner-badge">
                <ShieldCheckIcon size={14} />
                <span>Enterprise POS &amp; ERP System</span>
              </div>
              <h3>SWAMIDATT FOOTWEAR Retail Management &amp; POS</h3>
              <p>
                Behind our shop stands a tailored management and point-of-sale software designed specifically for footwear retail. From barcode scanning and size stock control to instant tax invoices and revenue reports, the platform powers our entire store lifecycle.
              </p>
              <div className="software-banner-action">
                <Link to="/login" className="btn-software-login" id="software-login-button">
                  <LockIcon size={16} />
                  <span>Login to POS Terminal</span>
                </Link>
              </div>
            </div>

            <div className="software-stats-grid">
              <div className="software-stat-box">
                <div className="software-stat-number">Real-Time</div>
                <div className="software-stat-label">Size-by-Size Stock Tracking</div>
              </div>
              <div className="software-stat-box">
                <div className="software-stat-number">1-Click</div>
                <div className="software-stat-label">Barcode Billing &amp; Invoicing</div>
              </div>
              <div className="software-stat-box">
                <div className="software-stat-number">Thermal &amp; A4</div>
                <div className="software-stat-label">Direct Hardware Printing</div>
              </div>
              <div className="software-stat-box">
                <div className="software-stat-number">GST Compliant</div>
                <div className="software-stat-label">Automated Tax Calculations</div>
              </div>
            </div>
          </div>

          {/* Software Feature Grid */}
          <div className="section-header-block" style={{ marginBottom: 36 }}>
            <span className="section-eyebrow">Terminal Modules</span>
            <h3 className="section-title" style={{ fontSize: '1.8rem' }}>Integrated Operations Suite</h3>
            <p className="section-subtitle">
              Comprehensive operational tools engineered for precision footwear store management.
            </p>
          </div>

          <div className="software-features-grid">
            {/* 1. POS Billing */}
            <div className="software-feature-card">
              <div className="software-feat-icon">
                <BillIcon size={20} />
              </div>
              <h4>POS Billing</h4>
              <p>High-speed barcode scanner checkout, size selection, item discount, and multi-mode payment handling.</p>
            </div>

            {/* 2. Sales Invoices */}
            <div className="software-feature-card">
              <div className="software-feat-icon">
                <SalesIcon size={20} />
              </div>
              <h4>Sales Invoices</h4>
              <p>Searchable invoice archives, reprint capabilities, thermal POS slip generation, and PDF export.</p>
            </div>

            {/* 3. Product & Item Management */}
            <div className="software-feature-card">
              <div className="software-feat-icon">
                <ProductIcon size={20} />
              </div>
              <h4>Product Management</h4>
              <p>Footwear model directory, barcode indexing, MRP/selling prices, and category-level size ranges.</p>
            </div>

            {/* 4. Stock Inventory */}
            <div className="software-feature-card">
              <div className="software-feat-icon">
                <StockIcon size={20} />
              </div>
              <h4>Stock Inventory</h4>
              <p>Live inventory per shoe size, stock adjustments, and low-inventory tracking across sizes.</p>
            </div>

            {/* 5. Customer Management */}
            <div className="software-feature-card">
              <div className="software-feat-icon">
                <CustomerIcon size={20} />
              </div>
              <h4>Customer Management</h4>
              <p>Customer contact directories, billing histories, walk-in records, and credit ledger management.</p>
            </div>

            {/* 6. Barcode Studio */}
            <div className="software-feature-card">
              <div className="software-feat-icon">
                <BarcodeNavIcon size={20} />
              </div>
              <h4>Barcode Studio</h4>
              <p>Generate print-ready standard CODE128 footwear barcode labels with model code, price, and size.</p>
            </div>

            {/* 7. Purchase Inward */}
            <div className="software-feature-card">
              <div className="software-feat-icon">
                <PurchaseIcon size={20} />
              </div>
              <h4>Purchase Inward</h4>
              <p>Supplier purchase records, stock inward batch processing, and purchase cost tracking.</p>
            </div>

            {/* 8. Reports & Analysis */}
            <div className="software-feature-card">
              <div className="software-feat-icon">
                <ReportIcon size={20} />
              </div>
              <h4>Reports &amp; Analytics</h4>
              <p>Financial dashboards, payment mode breakdowns, tax summaries, and store performance trends.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          6. CONTACT SECTION
          ==================================================================== */}
      <section className="landing-section section-bg-light" id="contact">
        <div className="landing-container">
          <div className="section-header-block">
            <span className="section-eyebrow">Connect With Us</span>
            <h2 className="section-title">Visit Our Shop</h2>
            <p className="section-subtitle">
              We welcome you to visit Swamidatt Agency for quality footwear selections, sizing assistance, and personal attention.
            </p>
          </div>

          <div className="contact-grid">
            {/* Main Verified Info Card */}
            <div className="contact-card-main">
              <h3>{SHOP_INFO.name}</h3>
              <p>Swamidatt Agency &bull; Retail Footwear &amp; Accessories</p>

              <div className="contact-info-list">
                <div className="contact-info-item">
                  <div className="contact-icon-bubble">
                    <MapPinIcon size={20} />
                  </div>
                  <div className="contact-item-text">
                    <h5>Store Location</h5>
                    <p>{SHOP_INFO.address}</p>
                  </div>
                </div>

                <div className="contact-info-item">
                  <div className="contact-icon-bubble">
                    <PhoneIcon size={20} />
                  </div>
                  <div className="contact-item-text">
                    <h5>Contact Helpline</h5>
                    <p>{SHOP_INFO.phone}</p>
                  </div>
                </div>

                <div className="contact-info-item">
                  <div className="contact-icon-bubble">
                    <ShieldCheckIcon size={20} />
                  </div>
                  <div className="contact-item-text">
                    <h5>GSTIN Tax Identification</h5>
                    <p>{SHOP_INFO.gst}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Terminal Quick Gate Card */}
            <div className="contact-side-card">
              <div>
                <h4>Store Staff &amp; Management</h4>
                <p>
                  Authorized operators and management personnel can access the ERP terminal for billing, stock updates, barcode generation, and daily accounts.
                </p>
              </div>

              <div className="contact-side-cta">
                <p>Ready to operate the store terminal?</p>
                <Link to="/login" className="btn-primary-hero" style={{ width: '100%', justifyContent: 'center' }}>
                  <LockIcon size={16} />
                  <span>Access Login Portal</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          7. FOOTER
          ==================================================================== */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="footer-top-grid">
            {/* Column 1: Brand Info */}
            <div className="footer-brand-col">
              <div className="footer-logo-row">
                <img
                  src="/Swamidatt_Agency.png"
                  alt="SWAMIDATT FOOTWEAR Logo"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <span className="footer-brand-title">{SHOP_INFO.name}</span>
              </div>
              <p className="footer-brand-desc">
                Swamidatt Agency &bull; Retail Footwear &amp; Accessories. Bringing quality, comfort, and style to our customers with modern retail operations.
              </p>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Retail Management &amp; POS Software
              </div>
            </div>

            {/* Column 2: Navigation Links */}
            <div>
              <div className="footer-col-title">Quick Links</div>
              <ul className="footer-links-list">
                <li><a href="#home" onClick={(e) => scrollToSection(e, 'home')}>Home</a></li>
                <li><a href="#about" onClick={(e) => scrollToSection(e, 'about')}>About Us</a></li>
                <li><a href="#services" onClick={(e) => scrollToSection(e, 'services')}>Our Services</a></li>
                <li><a href="#software" onClick={(e) => scrollToSection(e, 'software')}>POS Software</a></li>
                <li><a href="#contact" onClick={(e) => scrollToSection(e, 'contact')}>Contact Details</a></li>
                <li><Link to="/login" style={{ color: '#60a5fa', fontWeight: 600 }}>Login to Dashboard &rarr;</Link></li>
              </ul>
            </div>

            {/* Column 3: Store Contact Summary */}
            <div>
              <div className="footer-col-title">Store Details</div>
              <div className="footer-contact-summary">
                <p style={{ margin: '0 0 8px 0', color: '#ffffff', fontWeight: 600 }}>{SHOP_INFO.name}</p>
                <p style={{ margin: '0 0 8px 0' }}>{SHOP_INFO.address}</p>
                <p style={{ margin: '0 0 8px 0' }}>Phone: {SHOP_INFO.phone}</p>
                <p style={{ margin: '0' }}>GSTIN: {SHOP_INFO.gst}</p>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="footer-bottom-bar">
            <div>
              &copy; {new Date().getFullYear()} {SHOP_INFO.name} &bull; Swamidatt Agency. All rights reserved.
            </div>
            <div>
              <Link to="/login">Employee / Operator Login</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
