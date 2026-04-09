import Link from "next/link";

const TAREFAS_URL = "https://its-tarefas-7xlm.onrender.com/";

export default function Portal() {
  return (
    <main className="min-h-screen bg-its-dark text-white">
      {/* ============ HEADER ============ */}
      <header className="relative z-20 flex items-center justify-between p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-its-green"
            style={{ clipPath: "polygon(0 50%, 50% 0, 100% 50%, 50% 100%)" }} />
          <div>
            <div className="text-xl font-bold tracking-tight">ITS</div>
            <div className="text-[10px] text-its-green -mt-1">Tax and Corporate</div>
          </div>
        </div>
        <nav className="hidden md:flex gap-8 text-sm text-gray-300">
          <a href="#areas" className="hover:text-its-green transition">Áreas de atuação</a>
          <a href="#acesso" className="hover:text-its-green transition">Acessar portal</a>
        </nav>
        <Link href="/login" className="text-sm text-gray-300 hover:text-its-green">Entrar</Link>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(10,10,10,0.85), rgba(10,10,10,0.95)), url('https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1920&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="g" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#00E676" strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#g)" />
        </svg>

        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-32 text-center">
          <div className="inline-block text-[10px] font-bold tracking-widest text-its-green border border-its-green/40 rounded-full px-4 py-1.5">
            INTELIGÊNCIA FISCAL · AUDITORIA · PLANEJAMENTO
          </div>
          <h1 className="mt-6 text-5xl md:text-7xl font-bold leading-tight">
            Pague o imposto <span className="text-its-green">certo.</span><br />
            Nem mais, nem menos.
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-gray-300 text-lg">
            Auditoria tributária, planejamento mensal e indicadores financeiros para
            empresas que querem transformar compliance em economia real.
          </p>
          <a href="#acesso" className="btn-green inline-block mt-10">
            Acessar portal →
          </a>
        </div>
      </section>

      {/* ============ ÁREAS DE ATUAÇÃO ============ */}
      <section id="areas" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="text-[10px] font-bold tracking-widest text-its-green">NOSSA ATUAÇÃO</div>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold">Áreas em que atendemos</h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
            Soluções especializadas em tributário, contábil e consultivo para empresas de todos os portes.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ServiceCard
            img="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80"
            title="Auditoria Tributária"
            desc="Revisão completa de SPED, apurações e obrigações acessórias para identificar pagamentos indevidos e riscos fiscais."
          />
          <ServiceCard
            img="https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=800&q=80"
            title="Planejamento Tributário"
            desc="Comparativo mensal entre Simples, Presumido e Real com recomendação baseada no seu balancete atual."
          />
          <ServiceCard
            img="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80"
            title="Consultoria Contábil"
            desc="Suporte técnico permanente ao seu contador, revisão de balancetes e adequação às normas vigentes."
          />
          <ServiceCard
            img="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80"
            title="Recuperação de Créditos"
            desc="Identificação e habilitação de créditos de PIS, COFINS, ICMS e INSS não aproveitados nos últimos 5 anos."
          />
          <ServiceCard
            img="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80"
            title="Indicadores Financeiros"
            desc="Dashboard mensal com margens, liquidez, ROE, endividamento e comparativo ano a ano."
          />
          <ServiceCard
            img="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=800&q=80"
            title="Compliance Fiscal"
            desc="Monitoramento de obrigações, certidões e vencimentos para manter sua empresa 100% em dia com o Fisco."
          />
        </div>
      </section>

      {/* ============ NÚMEROS ============ */}
      <section className="bg-its-darker border-y border-its-gray py-16">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <Stat number="+150" label="Empresas atendidas" />
          <Stat number="R$ 12M" label="Economia gerada" />
          <Stat number="98%" label="Obrigações em dia" />
          <Stat number="15 anos" label="De experiência" />
        </div>
      </section>

      {/* ============ PORTAL / ACESSO ============ */}
      <section id="acesso" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <div className="text-[10px] font-bold tracking-widest text-its-green">PORTAL ITS</div>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold">Acesse sua área</h2>
          <p className="mt-4 text-gray-400">Login único e seguro para clientes e equipe ITS.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <AreaCard
            href="/login"
            badge="PARA CLIENTES"
            title="Área do Cliente"
            desc="Indicadores, planejamento tributário mensal, economia gerada, documentos e chamados."
            icon="👤"
          />
          <AreaCard
            href={TAREFAS_URL}
            badge="EQUIPE ITS"
            title="Escritório ITS"
            desc="Controle de tarefas, checklist, clientes, histórico e relatórios internos da equipe."
            icon="⚙️"
            external
          />
        </div>
      </section>

      <footer className="border-t border-its-gray p-6 text-xs text-gray-500 text-center">
        © 2026 ITS Tax and Corporate · Confidencial
      </footer>
    </main>
  );
}

function ServiceCard({ img, title, desc }: { img: string; title: string; desc: string }) {
  return (
    <div className="card overflow-hidden group hover:border-its-green transition">
      <div className="relative h-48 overflow-hidden">
        <img
          src={img}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-its-dark via-transparent to-transparent" />
      </div>
      <div className="p-6">
        <div className="text-xl font-bold">{title}</div>
        <div className="mt-2 text-sm text-gray-400 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="text-4xl md:text-5xl font-bold text-its-green">{number}</div>
      <div className="mt-2 text-xs tracking-wider text-gray-400 uppercase">{label}</div>
    </div>
  );
}

function AreaCard({ href, badge, title, desc, icon, external }:
  { href: string; badge: string; title: string; desc: string; icon: string; external?: boolean }) {
  const Tag: any = external ? "a" : Link;
  const props = external
    ? { href, target: "_blank", rel: "noopener noreferrer", className: "card p-8 block hover:border-its-green transition group" }
    : { href, className: "card p-8 block hover:border-its-green transition group" };
  return (
    <Tag {...props}>
      <div className="flex items-start justify-between">
        <div className="text-5xl">{icon}</div>
        <div className="text-its-green text-[10px] font-bold tracking-wider">{badge}</div>
      </div>
      <div className="mt-6 text-2xl font-bold">{title}</div>
      <div className="mt-3 text-sm text-gray-400 leading-relaxed">{desc}</div>
      <div className="mt-6 text-its-green text-sm font-bold group-hover:translate-x-1 transition-transform">
        Acessar {external && "↗"} →
      </div>
    </Tag>
  );
}
