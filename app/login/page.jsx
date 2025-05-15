'use client';
import { signIn }                      from 'next-auth/react';
import { useForm }                     from 'react-hook-form';
import { zodResolver }                 from '@hookform/resolvers/zod';
import { z }                           from 'zod';
import { useRouter }                   from 'next/navigation';
import Link                           from 'next/link';
import { useState }                   from 'react';

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
});

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  // ← Accept `data` parameter here
  const onSubmit = async (data) => {
    const result = await signIn('credentials', {
      redirect: false,
      email: data.email,
      password: data.password,
    });

    if (result?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/Dashboard');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-6">Login</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

        {error && <p className="text-red-500 text-center">{error}</p>}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Login
        </button>
        
        <div className="text-center mt-4">
          Don&apos;t have an account?{' '}
          <Link href="/" className="text-blue-600 hover:underline">
            Sign Up
          </Link>
        </div>
      </form>
    </div>
  );
}
