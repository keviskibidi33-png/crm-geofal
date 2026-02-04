import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileSearch } from 'lucide-react'

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-4">
            <div className="bg-white p-10 rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full text-center space-y-6">
                <div className="mx-auto w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center">
                    <FileSearch className="w-10 h-10 text-zinc-400" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-6xl font-black text-zinc-900 tracking-tighter">404</h1>
                    <h2 className="text-xl font-bold text-zinc-800">Página no encontrada</h2>
                    <p className="text-zinc-500 text-sm">
                        Lo sentimos, la página que buscas no existe o ha sido movida.
                    </p>
                </div>

                <div className="pt-4">
                    <Button asChild className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold h-12">
                        <Link href="/">
                            Regresar al CRM
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
