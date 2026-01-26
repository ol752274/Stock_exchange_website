'use client'

import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import InputField from '@/components/forms/InputField'
import FooterLink from '@/components/forms/FooterLink'

type SignInFormData = {
  email: string
  password: string
}

const SignIn = () => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onBlur',
  })

  const onSubmit = async (data: SignInFormData) => {
    console.log('Sign In Data:', data)
    // 🔐 You will connect backend auth later
  }

  return (
    <>
      <h1 className="form-title">Welcome Back</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <InputField
          name="email"
          label="Email"
          placeholder="omesh@gmail.com"
          register={register}
          error={errors.email}
          validation={{
            required: 'Email is required',
            pattern: {
              value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
              message: 'Invalid email address',
            },
          }}
        />

        <InputField
          name="password"
          label="Password"
          placeholder="Enter your password"
          type="password"
          register={register}
          error={errors.password}
          validation={{
            required: 'Password is required',
            minLength: {
              value: 6,
              message: 'Password must be at least 6 characters',
            },
          }}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          className="yellow-btn w-full mt-5"
        >
          {isSubmitting ? 'Signing In...' : 'Sign In'}
        </Button>

        <FooterLink
          text="Don't have an account?"
          linkText="Sign Up"
          href="/sign-up"
        />
      </form>
    </>
  )
}

export default SignIn
