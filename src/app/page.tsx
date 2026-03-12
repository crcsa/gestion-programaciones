export default function HomePage() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
        Gestion de Programaciones
      </h1>
      <p style={{ color: '#666' }}>
        Cruz Roja Colombiana - Seccional Antioquia
      </p>
    </main>
  )
}
