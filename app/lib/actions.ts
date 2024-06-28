'use server';

import { signIn } from '@/auth';
import { sql } from '@vercel/postgres';
import { AuthError } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Por favor seleccione un cliente.',
    }),
    amount: z.coerce.number().gt(0, {
        message: 'Por favor ingrese un monto en S/.'
    }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Por favor seleccione un estado de la factura.'
    }),
    date: z.string(),
});

export type State = {
    message?: string | null;
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
}

const CreateInvoice = FormSchema.omit({ id: true, date: true });

async function createInvoice(prevState: State, formData: FormData) {
    // Validar el formulario con Zod.
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    // Si la validación falla, retorna error. Caso contrario continue.
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Campos faltantes. No se pudo crear la factura.',
        };
    }

    // Prepara los datos para la inserción a la base de datos.
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    // Inserta los datos a la base de datos.
    try {
        await sql `
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch (error) {
        // Retorna un mensaje de error si la base de datos falla.
        return {
            message: 'Database Error: Failed to Create Invoice.',
        };
    }

    // Re-valida la chache de las facturas y redirige a dicha ruta al usuario.
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

async function updateInvoice(id: string, prevState: State, formData: FormData) {
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Campos faltantes. No se pudo actualizar la factura.',
        }
    }

    const { customerId, amount, status } = UpdateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    const amountInCents = amount * 100;

    try {
        await sql `
            UPDATE invoices
            SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
            WHERE id = ${id}
        `;
    } catch (error) {
        return {
            message: 'Database Error: Failed to Update Invoice.',
        };
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

async function deleteInvoice(id: string) {
    try {
        await sql `DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices')
        return { message: 'Deleted Invoice.'}
    } catch (error) {
        return {
            message: 'Database Error: Failed to Delete Invoice.',
        };
    }
}

async function authenticate(prevState: string | undefined, formData: FormData) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
    }
}

export { createInvoice, updateInvoice, deleteInvoice, authenticate };