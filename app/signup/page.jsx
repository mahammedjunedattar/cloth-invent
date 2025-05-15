// app/signup/page.js
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2)
});

export default function SignupPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(signupSchema)
  });

  const onSubmit = async (data) => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      console.log(response)

      if (!response.ok) throw new Error('Signup failed');
      router.push('/login');
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-6">Create Account</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block mb-1">Name</label>
          <input
            {...register('name')}
            className="w-full p-2 border rounded"
          />
          {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
        </div>
        
        <div>
          <label className="block mb-1">Email</label>
          <input
            type="email"
            {...register('email')}
            className="w-full p-2 border rounded"
          />
          {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block mb-1">Password</label>
          <input
            type="password"
            {...register('password')}
            className="w-full p-2 border rounded"
          />
          {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Sign Up
        </button>
        
        <div className="text-center mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Login
          </Link>
        </div>
      </form>
    </div>
  );
}