"use client"

import { useState } from "react"
import { Megaphone } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

interface AnnouncementDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AnnouncementDrawer({ open, onOpenChange }: AnnouncementDrawerProps) {
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [priority, setPriority] = useState("")
  const [target, setTarget] = useState("")

  function handleSubmit() {
    onOpenChange(false)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Megaphone className="size-5" />
            New Announcement
          </DrawerTitle>
          <DrawerDescription>
            Create a new notice for students and staff
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="a-title">Title</Label>
            <Input
              id="a-title"
              placeholder="Enter the title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-message">Message</Label>
            <textarea
              id="a-message"
              placeholder="Write your announcement..."
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full min-h-20 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Target Audience</Label>
              <Select value={target} onValueChange={(v) => setTarget(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students & Staff</SelectItem>
                  <SelectItem value="students">All Students</SelectItem>
                  <SelectItem value="python">Python Students</SelectItem>
                  <SelectItem value="java">Java Students</SelectItem>
                  <SelectItem value="staff">All Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DrawerFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Publish Announcement</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
