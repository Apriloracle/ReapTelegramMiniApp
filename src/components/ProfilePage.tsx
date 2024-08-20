import React, { useState, ChangeEvent, FormEvent } from 'react';

interface FormData {
  sex: string;
  age: string;
  shoppingFrequency: string;
  interests: string[];
  shoppingCategories: string[];
}

const ProfilePage: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    sex: '',
    age: '',
    shoppingFrequency: '',
    interests: [],
    shoppingCategories: []
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked 
          ? [...prev[name as keyof FormData] as string[], value]
          : (prev[name as keyof FormData] as string[]).filter(item => item !== value)
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(formData);
    // Here you would typically send the data to your backend
  };

  return (
    <div className="bg-black text-white p-4 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Survey</h1>
      <p className="mb-4">Complete your profile and earn rewards</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="mb-2">Sex</p>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, sex: 'Female' }))}
              className={`px-4 py-2 rounded ${formData.sex === 'Female' ? 'bg-orange-500' : 'bg-gray-700'}`}
            >
              Female
            </button>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, sex: 'Male' }))}
              className={`px-4 py-2 rounded ${formData.sex === 'Male' ? 'bg-orange-500' : 'bg-gray-700'}`}
            >
              Male
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2">Age</p>
          <div className="grid grid-cols-3 gap-2">
            {['18-18', '19-24', '24-30', '31-40', '41-50', '51+'].map((age) => (
              <button
                key={age}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, age }))}
                className={`px-4 py-2 rounded ${formData.age === age ? 'bg-orange-500' : 'bg-gray-700'}`}
              >
                {age}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2">How Frequent do You shop Online</p>
          <div className="flex space-x-2">
            {['Never', 'Daily', 'Weekly', 'Monthly'].map((freq) => (
              <button
                key={freq}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, shoppingFrequency: freq }))}
                className={`px-4 py-2 rounded ${formData.shoppingFrequency === freq ? 'bg-orange-500' : 'bg-gray-700'}`}
              >
                {freq}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2">Interest</p>
          <div className="grid grid-cols-3 gap-2">
            {['Tech', 'Cars', 'Cooking', 'Fashion', 'Games', 'Art', 'Movies', 'Sports', 'Music', 'Photography', 'Food', 'Travel'].map((interest) => (
              <label key={interest} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="interests"
                  value={interest}
                  checked={formData.interests.includes(interest)}
                  onChange={handleChange}
                  className="form-checkbox text-orange-500"
                />
                <span>{interest}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2">Shopping</p>
          <div className="grid grid-cols-2 gap-2">
            {['Electronics', 'Gaming', 'Movies', 'Sporting Gear', 'Phones & Tablets', 'Appliance'].map((category) => (
              <label key={category} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="shoppingCategories"
                  value={category}
                  checked={formData.shoppingCategories.includes(category)}
                  onChange={handleChange}
                  className="form-checkbox text-orange-500"
                />
                <span>{category}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-orange-500 text-white py-2 rounded-full"
        >
          Save
        </button>
      </form>
    </div>
  );
};

export default ProfilePage;
