export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      branches: {
        Row: {
          id: string
          name: string
          tag: string | null
          address: string
          city: string
          note: string | null
          is_primary: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          tag?: string | null
          address: string
          city: string
          note?: string | null
          is_primary?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          tag?: string | null
          address?: string
          city?: string
          note?: string | null
          is_primary?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      courses: {
        Row: {
          id: string
          slug: string
          name: string
          short_name: string
          duration: string
          type: "long-term" | "short-term"
          description: string
          full_description: string
          topics: string[]
          fees: string
          fee_numeric: number
          eligibility: string
          certification: string
          certification_body: string
          popular: boolean
          highlights: string[]
          career_opportunities: string[]
          tools: string[]
          schedule: string
          batch_size: string
          rating: number
          completion_rate: number
          next_batch: string | null
          status: "active" | "upcoming" | "full"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          short_name: string
          duration: string
          type: "long-term" | "short-term"
          description: string
          full_description: string
          topics?: string[]
          fees: string
          fee_numeric?: number
          eligibility: string
          certification: string
          certification_body: string
          popular?: boolean
          highlights?: string[]
          career_opportunities?: string[]
          tools?: string[]
          schedule: string
          batch_size: string
          rating?: number
          completion_rate?: number
          next_batch?: string | null
          status?: "active" | "upcoming" | "full"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          short_name?: string
          duration?: string
          type?: "long-term" | "short-term"
          description?: string
          full_description?: string
          topics?: string[]
          fees?: string
          fee_numeric?: number
          eligibility?: string
          certification?: string
          certification_body?: string
          popular?: boolean
          highlights?: string[]
          career_opportunities?: string[]
          tools?: string[]
          schedule?: string
          batch_size?: string
          rating?: number
          completion_rate?: number
          next_batch?: string | null
          status?: "active" | "upcoming" | "full"
          created_at?: string
          updated_at?: string
        }
      }
      students: {
        Row: {
          id: string
          user_id: string | null
          full_name: string
          email: string | null
          phone: string
          date_of_birth: string | null
          gender: "male" | "female" | "other" | null
          address: string | null
          branch_id: string | null
          course_slug: string | null
          enrollment_date: string
          batch_time: string | null
          status: "Active" | "Inactive" | "Pending"
          father_name: string | null
          father_phone: string | null
          mother_name: string | null
          alternate_phone: string | null
          profile_photo: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id?: string | null
          full_name: string
          email?: string | null
          phone: string
          date_of_birth?: string | null
          gender?: "male" | "female" | "other" | null
          address?: string | null
          branch_id?: string | null
          course_slug?: string | null
          enrollment_date?: string
          batch_time?: string | null
          status?: "Active" | "Inactive" | "Pending"
          father_name?: string | null
          father_phone?: string | null
          mother_name?: string | null
          alternate_phone?: string | null
          profile_photo?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          full_name?: string
          email?: string | null
          phone?: string
          date_of_birth?: string | null
          gender?: "male" | "female" | "other" | null
          address?: string | null
          branch_id?: string | null
          course_slug?: string | null
          enrollment_date?: string
          batch_time?: string | null
          status?: "Active" | "Inactive" | "Pending"
          father_name?: string | null
          father_phone?: string | null
          mother_name?: string | null
          alternate_phone?: string | null
          profile_photo?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      teachers: {
        Row: {
          id: string
          user_id: string | null
          full_name: string
          email: string
          phone: string
          role: string
          branch_id: string | null
          subjects: string[]
          experience: number
          qualification: string | null
          specialization: string | null
          salary: number | null
          status: "Active" | "On Leave"
          profile_photo: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id?: string | null
          full_name: string
          email: string
          phone: string
          role: string
          branch_id?: string | null
          subjects?: string[]
          experience?: number
          qualification?: string | null
          specialization?: string | null
          salary?: number | null
          status?: "Active" | "On Leave"
          profile_photo?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          full_name?: string
          email?: string
          phone?: string
          role?: string
          branch_id?: string | null
          subjects?: string[]
          experience?: number
          qualification?: string | null
          specialization?: string | null
          salary?: number | null
          status?: "Active" | "On Leave"
          profile_photo?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      admins: {
        Row: {
          id: string
          user_id: string | null
          full_name: string
          email: string
          phone: string | null
          branch_id: string | null
          role: string
          bio: string | null
          profile_photo: string | null
          admin_code: string | null
          status: string
          notify_email: boolean
          notify_sms: boolean
          notify_whatsapp: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          full_name: string
          email: string
          phone?: string | null
          branch_id?: string | null
          role?: string
          bio?: string | null
          profile_photo?: string | null
          admin_code?: string | null
          status?: string
          notify_email?: boolean
          notify_sms?: boolean
          notify_whatsapp?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          full_name?: string
          email?: string
          phone?: string | null
          branch_id?: string | null
          role?: string
          bio?: string | null
          profile_photo?: string | null
          admin_code?: string | null
          status?: string
          notify_email?: boolean
          notify_sms?: boolean
          notify_whatsapp?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      fees: {
        Row: {
          id: string
          student_id: string
          course_slug: string | null
          total_fee: number
          paid_amount: number
          pending_amount: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          course_slug?: string | null
          total_fee: number
          paid_amount?: number
          pending_amount?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          course_slug?: string | null
          total_fee?: number
          paid_amount?: number
          pending_amount?: number
          created_at?: string
          updated_at?: string
        }
      }
      fee_installments: {
        Row: {
          id: string
          fee_id: string
          label: string
          amount: number
          due_date: string
          paid_date: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          fee_id: string
          label: string
          amount: number
          due_date: string
          paid_date?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          fee_id?: string
          label?: string
          amount?: number
          due_date?: string
          paid_date?: string | null
          status?: string
          created_at?: string
        }
      }
      fee_extras: {
        Row: {
          id: string
          fee_id: string
          label: string
          amount: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          fee_id: string
          label: string
          amount: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          fee_id?: string
          label?: string
          amount?: number
          status?: string
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          student_id: string
          student_name: string
          course_slug: string | null
          amount: number
          payment_date: string
          method: string
          status: "Paid" | "Pending" | "Partial" | "Overdue"
          receipt_no: string | null
          description: string | null
          branch_id: string | null
          installment_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          student_id: string
          student_name: string
          course_slug?: string | null
          amount: number
          payment_date: string
          method: string
          status?: "Paid" | "Pending" | "Partial" | "Overdue"
          receipt_no?: string | null
          description?: string | null
          branch_id?: string | null
          installment_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          student_name?: string
          course_slug?: string | null
          amount?: number
          payment_date?: string
          method?: string
          status?: "Paid" | "Pending" | "Partial" | "Overdue"
          receipt_no?: string | null
          description?: string | null
          branch_id?: string | null
          installment_id?: string | null
          created_at?: string
        }
      }
      attendance: {
        Row: {
          id: string
          student_id: string
          date: string
          time_in: string | null
          time_out: string | null
          hours: number
          status: "Present" | "Absent" | "Late" | "Leave"
          course_slug: string | null
          branch_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          date: string
          time_in?: string | null
          time_out?: string | null
          hours?: number
          status: "Present" | "Absent" | "Late" | "Leave"
          course_slug?: string | null
          branch_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          date?: string
          time_in?: string | null
          time_out?: string | null
          hours?: number
          status?: "Present" | "Absent" | "Late" | "Leave"
          course_slug?: string | null
          branch_id?: string | null
          created_at?: string
        }
      }
      certificates: {
        Row: {
          id: string
          student_id: string
          student_name: string
          course_slug: string | null
          name: string
          type: "Completion" | "Proficiency" | "Module"
          issued_date: string | null
          credential_id: string | null
          issued_by: string | null
          branch_id: string | null
          status: "Issued" | "Pending" | "Rejected" | "Processing" | "Requested"
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          student_id: string
          student_name: string
          course_slug?: string | null
          name: string
          type: "Completion" | "Proficiency" | "Module"
          issued_date?: string | null
          credential_id?: string | null
          issued_by?: string | null
          branch_id?: string | null
          status?: "Issued" | "Pending" | "Rejected" | "Processing" | "Requested"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          student_name?: string
          course_slug?: string | null
          name?: string
          type?: "Completion" | "Proficiency" | "Module"
          issued_date?: string | null
          credential_id?: string | null
          issued_by?: string | null
          branch_id?: string | null
          status?: "Issued" | "Pending" | "Rejected" | "Processing" | "Requested"
          created_at?: string
          updated_at?: string
        }
      }
      videos: {
        Row: {
          id: string
          title: string
          url: string | null
          course_slug: string | null
          duration: string | null
          views: number
          uploaded_by: string | null
          upload_date: string
          status: "Published" | "Draft" | "Processing"
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          title: string
          url?: string | null
          course_slug?: string | null
          duration?: string | null
          views?: number
          uploaded_by?: string | null
          upload_date?: string
          status?: "Published" | "Draft" | "Processing"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          url?: string | null
          course_slug?: string | null
          duration?: string | null
          views?: number
          uploaded_by?: string | null
          upload_date?: string
          status?: "Published" | "Draft" | "Processing"
          created_at?: string
          updated_at?: string
        }
      }
      announcements: {
        Row: {
          id: string
          title: string
          message: string
          priority: "high" | "medium" | "low"
          target: string
          author_id: string | null
          author_name: string | null
          published_date: string
          pinned: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          title: string
          message: string
          priority?: "high" | "medium" | "low"
          target?: string
          author_id?: string | null
          author_name?: string | null
          published_date?: string
          pinned?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          message?: string
          priority?: "high" | "medium" | "low"
          target?: string
          author_id?: string | null
          author_name?: string | null
          published_date?: string
          pinned?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          date: string
          description: string
          category: string
          amount: number
          type: "income" | "expense"
          branch_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          description: string
          category: string
          amount: number
          type: "income" | "expense"
          branch_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          date?: string
          description?: string
          category?: string
          amount?: number
          type?: "income" | "expense"
          branch_id?: string | null
          created_at?: string
        }
      }
      activity_log: {
        Row: {
          id: string
          admin_id: string | null
          action: string
          type: string
          timestamp: string
        }
        Insert: {
          id?: string
          admin_id?: string | null
          action: string
          type: string
          timestamp?: string
        }
        Update: {
          id?: string
          admin_id?: string | null
          action?: string
          type?: string
          timestamp?: string
        }
      }
      events: {
        Row: {
          id: string
          name: string
          date: string
          type: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          date: string
          type: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          date?: string
          type?: string
          created_at?: string
        }
      }
      pending_tasks: {
        Row: {
          id: string
          task: string
          priority: string
          completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          task: string
          priority?: string
          completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          task?: string
          priority?: string
          completed?: boolean
          created_at?: string
        }
      }
      faculty: {
        Row: {
          id: string
          name: string
          role: string
          branch: string | null
          qualifications: string[]
          description: string | null
          is_founder: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          role: string
          branch?: string | null
          qualifications?: string[]
          description?: string | null
          is_founder?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: string
          branch?: string | null
          qualifications?: string[]
          description?: string | null
          is_founder?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      /**
       * Creates a student, one fees row and fee_installments row per course, and
       * a pending payments row, in a single transaction. Prices courses from
       * courses.fee_numeric. Added by supabase.sql; service_role
       * only, so the browser never calls it directly.
       */
      register_student: {
        Args: {
          p_user_id: string
          p_full_name: string
          p_email: string
          p_phone: string
          p_father_name: string
          p_father_phone: string
          p_branch_id: string
          p_course_slugs: string[]
          p_present_status: string
          p_signature: string
          p_payment_method: string
          p_payment_description: string
          p_paid_installment_nos?: number[]
          p_installment_count?: number
          p_custom_payment_amount?: number | null
          p_total_fee_override?: number | null
        }
        Returns: {
          student_id: string
          payment_id: string
          total_fee: number
        }[]
      }
      enroll_student_in_course: {
        Args: {
          p_user_id: string
          p_course_slug: string
          p_total_fee_override?: number | null
          p_initial_payment_amount?: number
          p_payment_method?: string
          p_payment_reference?: string
          p_verified_by?: string
        }
        Returns: {
          fee_id: string
          course_slug: string
          total_fee: number
        }[]
      }
    }
    Enums: {
      course_type: "long-term" | "short-term"
      course_status: "active" | "upcoming" | "full"
      student_status: "Active" | "Inactive" | "Pending"
      gender_type: "male" | "female" | "other"
      teacher_status: "Active" | "On Leave"
      payment_status: "Paid" | "Pending" | "Partial" | "Overdue"
      attendance_status: "Present" | "Absent" | "Late" | "Leave"
      certificate_status: "Issued" | "Pending" | "Rejected" | "Processing" | "Requested"
      certificate_type: "Completion" | "Proficiency" | "Module"
      video_status: "Published" | "Draft" | "Processing"
      announcement_priority: "high" | "medium" | "low"
      transaction_type: "income" | "expense"
      qualification_type: "B.Tech" | "M.Tech" | "MCA" | "M.Sc" | "PhD" | "Others"
      specialization_type: "Java" | "Python" | "Web Development" | "Database" | "Networking" | "MS-Office"
      experience_range: "0-1" | "1-3" | "3-5" | "5-10" | "10+"
      eligibility_type: "10th" | "12th" | "graduate" | "any"
    }
  }
}
